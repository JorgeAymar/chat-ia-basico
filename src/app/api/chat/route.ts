import { prisma } from "@/lib/prisma";
import {
  isModelAvailable,
  streamOllamaChat,
  buildOllamaMessage,
  getBaseUrl,
  type OllamaChatMessage,
  type Attachment,
} from "@/lib/ollama";
import { getSystemPrompt } from "@/lib/settings";

async function buildSystemMessage(): Promise<OllamaChatMessage | null> {
  const [prompt, memories] = await Promise.all([
    getSystemPrompt(),
    prisma.memory.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const memoryBlock =
    memories.length > 0
      ? `\n\nCosas que sabés sobre el usuario (memoria persistente entre conversaciones):\n${memories
          .map((m) => `- ${m.content}`)
          .join("\n")}`
      : "";

  const content = `${prompt}${memoryBlock}`.trim();
  return content ? { role: "system", content } : null;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_TEXT_CHARS = 100_000;
export const MAX_IMAGE_BASE64_CHARS = 8_000_000; // ~6MB decoded

export function parseAttachments(raw: unknown): Attachment[] | { error: string } {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return { error: "attachments debe ser un array" };
  if (raw.length > MAX_ATTACHMENTS) {
    return { error: `Máximo ${MAX_ATTACHMENTS} archivos adjuntos por mensaje` };
  }

  const attachments: Attachment[] = [];
  for (const item of raw) {
    if (
      !item ||
      typeof item.name !== "string" ||
      typeof item.mimeType !== "string" ||
      typeof item.content !== "string" ||
      (item.kind !== "text" && item.kind !== "image")
    ) {
      return { error: "Formato de adjunto inválido" };
    }
    if (item.kind === "text" && item.content.length > MAX_TEXT_CHARS) {
      return { error: `"${item.name}" es demasiado grande (máx. ${MAX_TEXT_CHARS} caracteres)` };
    }
    if (item.kind === "image" && item.content.length > MAX_IMAGE_BASE64_CHARS) {
      return { error: `"${item.name}" es demasiado grande (máx. ~6MB)` };
    }
    attachments.push({
      name: item.name,
      kind: item.kind,
      mimeType: item.mimeType,
      content: item.content,
    });
  }
  return attachments;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const conversationId = body?.conversationId as string | undefined;
  const userMessage = body?.message as string | undefined;

  if (!conversationId || (!userMessage?.trim() && !body?.attachments?.length)) {
    return Response.json(
      { error: "Faltan conversationId o message" },
      { status: 400 }
    );
  }

  const attachments = parseAttachments(body?.attachments);
  if ("error" in attachments) {
    return Response.json({ error: attachments.error }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  if (!(await isModelAvailable(conversation.model))) {
    return Response.json(
      { error: `El modelo "${conversation.model}" ya no está disponible en Ollama` },
      { status: 400 }
    );
  }

  // El historial que se manda a Ollama se arma a partir de lo que ya estaba
  // en la conversación + el mensaje nuevo, SIN persistirlo todavía: si Ollama
  // no responde, no queremos un mensaje de usuario huérfano en Postgres.
  const systemMessage = await buildSystemMessage();
  const history: OllamaChatMessage[] = [
    ...(systemMessage ? [systemMessage] : []),
    ...conversation.messages.map((m) =>
      m.role === "user"
        ? buildOllamaMessage("user", m.content, m.attachments as Attachment[] | null ?? undefined)
        : { role: "assistant" as const, content: m.content }
    ),
    buildOllamaMessage("user", userMessage ?? "", attachments),
  ];

  let ollamaStream: ReadableStream<Uint8Array>;
  try {
    ollamaStream = await streamOllamaChat(conversation.model, history);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : `No se pudo conectar con Ollama en ${getBaseUrl()}`;
    return Response.json({ error: message }, { status: 502 });
  }

  // Ollama aceptó la conexión: recién ahora persistimos el mensaje del
  // usuario y, si es el primero de la conversación, generamos el título.
  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: userMessage ?? "",
      attachments: attachments.length > 0 ? attachments : undefined,
    },
  });

  if (conversation.messages.length === 0) {
    const normalized = (userMessage ?? "").trim().replace(/\s+/g, " ");
    const fallback = attachments[0] ? `📎 ${attachments[0].name}` : "Nueva conversación";
    const base = normalized || fallback;
    const title = base.length > 45 ? `${base.slice(0, 45)}…` : base;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  const decoder = new TextDecoder();
  let fullResponse = "";
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const relayStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = ollamaStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        if (fullResponse.trim()) {
          try {
            await prisma.message.create({
              data: {
                conversationId,
                role: "assistant",
                content: fullResponse,
                model: conversation.model,
              },
            });
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });
          } catch (err) {
            console.error(
              `No se pudo guardar la respuesta del asistente para la conversación ${conversationId}:`,
              err
            );
          }
        } else {
          console.warn(
            `Ollama devolvió una respuesta vacía para la conversación ${conversationId} (modelo ${conversation.model})`
          );
        }
      }
    },
    cancel(reason) {
      // El cliente cerró la conexión (recargó/cerró la pestaña): cortamos
      // la lectura de Ollama en vez de dejarla generando en el vacío.
      reader?.cancel(reason).catch(() => {});
    },
  });

  return new Response(relayStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

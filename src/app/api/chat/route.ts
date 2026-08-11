import { prisma } from "@/lib/prisma";
import {
  getAvailableModels,
  streamOllamaChat,
  buildOllamaMessage,
  getBaseUrl,
  type OllamaChatMessage,
  type Attachment,
} from "@/lib/ollama";
import { getSystemPrompt } from "@/lib/settings";
import { encodeEvent, type ChatEvent, type Source } from "@/lib/stream";
import { searchWeb, buildSearchContext, toSearchQuery, SearchError } from "@/lib/search";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

async function buildSystemMessage(userId: string, extra?: string): Promise<OllamaChatMessage | null> {
  const [prompt, memories] = await Promise.all([
    getSystemPrompt(),
    prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  const memoryBlock =
    memories.length > 0
      ? `\n\nCosas que sabés sobre el usuario (memoria persistente entre conversaciones):\n${memories
          .map((m) => `- ${m.content}`)
          .join("\n")}`
      : "";

  const content = `${prompt}${memoryBlock}${extra ? `\n\n${extra}` : ""}`.trim();
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

type ChatBody = {
  conversationId?: string;
  message?: string;
  attachments?: unknown;
  webSearch?: boolean;
  // Rehacer la respuesta del asistente con este id: se borra esa respuesta
  // (y todo lo posterior) y se vuelve a generar desde el mismo historial.
  regenerateFrom?: string;
  // Editar este mensaje del usuario: se reemplaza su contenido, se borra
  // todo lo que venía después y se responde de nuevo.
  editMessageId?: string;
};

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const body = (await req.json().catch(() => null)) as ChatBody | null;
  const conversationId = body?.conversationId;

  if (!conversationId) {
    return Response.json({ error: "Falta conversationId" }, { status: 400 });
  }

  const isRegenerate = typeof body?.regenerateFrom === "string";
  const isEdit = typeof body?.editMessageId === "string";
  const userMessage = body?.message ?? "";

  const attachments = parseAttachments(body?.attachments);
  if ("error" in attachments) {
    return Response.json({ error: attachments.error }, { status: 400 });
  }

  if (!isRegenerate && !userMessage.trim() && attachments.length === 0) {
    return Response.json({ error: "Falta message" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId: auth.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // Solo se rechaza el modelo si Ollama contestó la lista Y el modelo no
  // está en ella. Si Ollama no respondió (`source: "offline"`), la lista
  // llega vacía y cualquier modelo parecería desinstalado: antes eso
  // convertía un hipo de red en un "el modelo ya no está disponible" que no
  // era cierto y dejaba el chat trabado. Ante la duda se sigue, y si el
  // problema es real lo reporta la llamada de chat con su error verdadero.
  const available = await getAvailableModels();
  if (available.source === "ollama" && !available.models.includes(conversation.model)) {
    return Response.json(
      { error: `El modelo "${conversation.model}" ya no está instalado en Ollama` },
      { status: 400 }
    );
  }

  // Regenerar y editar comparten la misma mecánica: se recorta el historial
  // hasta el punto pedido y se genera de nuevo desde ahí. La diferencia es
  // solo si el mensaje del usuario que queda al final se reescribe o no.
  let history = conversation.messages;
  const anchorId = body?.regenerateFrom ?? body?.editMessageId;

  if (anchorId) {
    const anchorIndex = history.findIndex((m) => m.id === anchorId);
    if (anchorIndex === -1) {
      return Response.json({ error: "Mensaje no encontrado en la conversación" }, { status: 404 });
    }

    const anchor = history[anchorIndex];
    if (isRegenerate && anchor.role !== "assistant") {
      return Response.json(
        { error: "Solo se pueden regenerar respuestas del asistente" },
        { status: 400 }
      );
    }
    if (isEdit && anchor.role !== "user") {
      return Response.json({ error: "Solo se pueden editar mensajes del usuario" }, { status: 400 });
    }

    // Se borra el ancla y todo lo posterior. Es destructivo a propósito: la
    // alternativa es ramificar la conversación, que necesita un árbol de
    // mensajes y un selector de rama en la UI.
    const doomed = history.slice(anchorIndex).map((m) => m.id);
    await prisma.message.deleteMany({ where: { id: { in: doomed } } });
    history = history.slice(0, anchorIndex);

    if (isEdit) {
      // El mensaje editado se vuelve a crear con el texto nuevo.
      const created = await prisma.message.create({
        data: {
          conversationId,
          role: "user",
          content: userMessage,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });
      history = [...history, created];
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ChatEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };

      let sources: Source[] = [];
      let searchContext = "";
      let content = "";
      let thinking = "";
      let userMessageId: string | null = null;
      // La duración del razonamiento se mide acá y no en React: el cliente
      // pierde su cronómetro al recargar, y el dato tiene que sobrevivir en
      // la base junto al mensaje.
      let thinkingStartedAt: number | null = null;
      let thinkingMs: number | null = null;

      try {
        // 1. Búsqueda web, si el usuario la pidió con el botón del composer.
        if (body?.webSearch) {
          // El texto a buscar sale del mensaje nuevo, o del último mensaje
          // del usuario cuando se está regenerando.
          const basis = isRegenerate
            ? [...history].reverse().find((m) => m.role === "user")?.content ?? ""
            : userMessage;
          const query = toSearchQuery(basis);

          if (query) {
            send({ type: "status", text: `Buscando en la web: "${query}"…` });
            try {
              sources = await searchWeb(query);
              if (sources.length > 0) {
                send({ type: "sources", sources });
                searchContext = buildSearchContext(query, sources);
              } else {
                send({ type: "status", text: "La búsqueda no devolvió resultados." });
              }
            } catch (error) {
              // Que falle el buscador no debería matar el chat: se avisa y se
              // responde igual con el conocimiento del modelo.
              const message =
                error instanceof SearchError
                  ? error.message
                  : "Falló la búsqueda web.";
              send({ type: "status", text: `${message} Respondo sin buscar.` });
            }
          }
        }

        // 2. Historial para Ollama. El razonamiento de turnos anteriores NO
        // se reinyecta: infla el contexto y los modelos se enredan leyendo
        // su propio borrador como si fuera la respuesta.
        const systemMessage = await buildSystemMessage(auth.id, searchContext);
        const ollamaMessages: OllamaChatMessage[] = [
          ...(systemMessage ? [systemMessage] : []),
          ...history.map((m) =>
            m.role === "user"
              ? buildOllamaMessage(
                  "user",
                  m.content,
                  (m.attachments as Attachment[] | null) ?? undefined
                )
              : { role: "assistant" as const, content: m.content }
          ),
        ];

        if (!isRegenerate && !isEdit) {
          ollamaMessages.push(buildOllamaMessage("user", userMessage, attachments));
        }

        // 3. Recién ahora se persiste el mensaje del usuario: si Ollama no
        // contesta, no queda un mensaje huérfano en la base.
        const deltas = streamOllamaChat(conversation.model, ollamaMessages, {
          signal: req.signal,
        });
        const iterator = deltas[Symbol.asyncIterator]();
        const first = await iterator.next();

        if (!isRegenerate && !isEdit) {
          const created = await prisma.message.create({
            data: {
              conversationId,
              role: "user",
              content: userMessage,
              attachments: attachments.length > 0 ? attachments : undefined,
            },
          });
          userMessageId = created.id;
        }

        if (history.length === 0 && !isRegenerate) {
          const normalized = userMessage.trim().replace(/\s+/g, " ");
          const fallback = attachments[0] ? `📎 ${attachments[0].name}` : "Nueva conversación";
          const base = normalized || fallback;
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { title: base.length > 45 ? `${base.slice(0, 45)}…` : base },
          });
        }

        if (userMessageId) {
          send({ type: "status", text: "" });
        }

        // 4. Relay de los tokens.
        const emit = (delta: { content: string; thinking: string }) => {
          if (delta.thinking) {
            thinkingStartedAt ??= Date.now();
            thinking += delta.thinking;
            send({ type: "thinking", text: delta.thinking });
          }
          if (delta.content) {
            // El primer token visible marca el fin del razonamiento.
            if (thinkingStartedAt !== null && thinkingMs === null) {
              thinkingMs = Date.now() - thinkingStartedAt;
              send({ type: "thinking-done", ms: thinkingMs });
            }
            content += delta.content;
            send({ type: "token", text: delta.content });
          }
        };

        if (!first.done && first.value) emit(first.value);
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          emit(next.value);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `No se pudo conectar con Ollama en ${getBaseUrl()}`;
        // Abortar desde el botón "Detener" no es un error que mostrar.
        const aborted = req.signal.aborted || (error as Error)?.name === "AbortError";
        if (!aborted) send({ type: "error", message });
      } finally {
        // El modelo razonó pero nunca llegó a escribir respuesta (se cortó,
        // falló, o solo devolvió razonamiento): sin token visible que cierre
        // el conteo, lo cierra el fin del stream.
        if (thinkingStartedAt !== null && thinkingMs === null) {
          thinkingMs = Date.now() - thinkingStartedAt;
          send({ type: "thinking-done", ms: thinkingMs });
        }

        // Lo generado hasta acá se guarda aunque el usuario haya cortado:
        // media respuesta útil es mejor que perderla entera.
        if (content.trim() || thinking.trim()) {
          try {
            await prisma.message.create({
              data: {
                conversationId,
                role: "assistant",
                content,
                thinking: thinking.trim() ? thinking : undefined,
                thinkingMs: thinkingMs ?? undefined,
                sources: sources.length > 0 ? sources : undefined,
                model: conversation.model,
              },
            });
          } catch (error) {
            console.error(
              `No se pudo guardar la respuesta del asistente para la conversación ${conversationId}:`,
              error
            );
          }
        }

        await prisma.conversation
          .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
          .catch(() => null);

        if (!closed) {
          try {
            controller.close();
          } catch {
            // Ya estaba cerrado porque el cliente se fue.
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      // NDJSON: un evento por línea. Ver src/lib/stream.ts.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Evita que un proxy tipo nginx acumule la respuesta y arruine el
      // streaming mostrando todo de golpe al final.
      "X-Accel-Buffering": "no",
    },
  });
}

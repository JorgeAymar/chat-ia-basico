export function getBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
}

async function fetchInstalledModelNames(): Promise<string[]> {
  const response = await fetch(`${getBaseUrl()}/api/tags`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Ollama respondió ${response.status} en /api/tags`);
  }
  const data = (await response.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

export type AvailableModels = {
  models: string[];
  defaultModel: string;
  // "ollama": detectados en vivo. "offline": Ollama no respondió, se usó .env tal cual.
  source: "ollama" | "offline";
  baseUrl: string;
  error?: string;
};

// Fuente de verdad para qué modelos puede usar la app: siempre lo que Ollama
// tenga instalado en este momento (GET /api/tags), en vivo. No se filtra por
// .env — si `ollama pull`/`ollama rm` cambia algo, la app lo refleja al toque.
export async function getAvailableModels(): Promise<AvailableModels> {
  const configuredDefault = process.env.OLLAMA_DEFAULT_MODEL?.trim();

  let installed: string[];
  try {
    installed = await fetchInstalledModelNames();
  } catch {
    return {
      models: [],
      defaultModel: "",
      source: "offline",
      baseUrl: getBaseUrl(),
      error: "No se pudo conectar con Ollama en " + getBaseUrl(),
    };
  }

  const defaultModel =
    configuredDefault && installed.includes(configuredDefault)
      ? configuredDefault
      : installed[0] ?? "";

  return {
    models: installed,
    defaultModel,
    source: "ollama",
    baseUrl: getBaseUrl(),
    error: installed.length === 0 ? "No hay modelos instalados en Ollama" : undefined,
  };
}

export async function isModelAvailable(model: string): Promise<boolean> {
  const { models } = await getAvailableModels();
  return models.includes(model);
}

export type OllamaChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  // Base64 sin el prefijo "data:...;base64,", como espera Ollama.
  images?: string[];
};

export type Attachment = {
  name: string;
  kind: "text" | "image";
  mimeType: string;
  // "text": contenido plano. "image": base64 sin el prefijo data:.
  content: string;
};

// Combina el texto del mensaje con sus adjuntos en el formato que espera
// Ollama: los archivos de texto se anexan al `content` como contexto citado,
// las imágenes van aparte en `images` (API multimodal de Ollama).
export function buildOllamaMessage(
  role: "user" | "assistant",
  text: string,
  attachments?: Attachment[]
): OllamaChatMessage {
  const textFiles = (attachments ?? []).filter((a) => a.kind === "text");
  const images = (attachments ?? [])
    .filter((a) => a.kind === "image")
    .map((a) => a.content);

  const content =
    text +
    textFiles
      .map(
        (a) =>
          `\n\n--- Archivo adjunto: ${a.name} ---\n${a.content}\n--- fin de ${a.name} ---`
      )
      .join("");

  return { role, content, images: images.length > 0 ? images : undefined };
}

// Llama a Ollama /api/chat en modo streaming y devuelve un ReadableStream
// de texto plano (solo el contenido del token, ya des-envuelto del NDJSON).
export async function streamOllamaChat(
  model: string,
  messages: OllamaChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${getBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Ollama respondió ${response.status}: ${text || "sin cuerpo"}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const token = parseNdjsonLine(line);
            if (token) controller.enqueue(encoder.encode(token));
          }
        }
        // Ollama no siempre termina el último chunk con "\n" — si quedó algo
        // pendiente en el buffer, es la última línea NDJSON y hay que
        // procesarla también (si no, se pierde el final de la respuesta).
        if (buffer.trim()) {
          const token = parseNdjsonLine(buffer);
          if (token) controller.enqueue(encoder.encode(token));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

// Parsea una línea NDJSON de /api/chat de Ollama y devuelve el texto del
// token (o null si la línea está vacía o no trae contenido). Si la línea
// no está vacía pero no es JSON válido, propaga el error de JSON.parse —
// el try/catch de streamOllamaChat lo captura y cierra el stream con error.
export function parseNdjsonLine(line: string): string | null {
  if (!line.trim()) return null;
  const chunk = JSON.parse(line) as {
    message?: { content?: string };
    done?: boolean;
  };
  const token = chunk.message?.content;
  return token ? token : null;
}

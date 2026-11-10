import { ThinkingSplitter } from "./stream";

export function getBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "");
}

// Un Ollama expuesto detrás de un proxy (por ejemplo el de labshub) pide un
// bearer token. Con `ollama serve` en localhost no hace falta: si la variable
// no está, no se manda ningún header y todo sigue como antes.
export function getAuthHeaders(): Record<string, string> {
  const token = process.env.OLLAMA_API_KEY?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Un Ollama remoto significa que el chat SÍ sale de la máquina, aunque el
// modelo no se llame "-cloud". La UI usa esto para no prometer privacidad
// que no puede cumplir.
export function isRemoteOllama(): boolean {
  try {
    const { hostname } = new URL(getBaseUrl());
    return !["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
}

async function fetchInstalledModelNames(): Promise<string[]> {
  const response = await fetch(`${getBaseUrl()}/api/tags`, {
    headers: getAuthHeaders(),
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
  // true si Ollama no corre en esta máquina: la UI no puede prometer que el
  // chat se queda local.
  remote: boolean;
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
      remote: isRemoteOllama(),
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
    remote: isRemoteOllama(),
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

// Lo que aporta una línea NDJSON de Ollama: texto visible y/o razonamiento.
export type OllamaDelta = {
  content: string;
  thinking: string;
};

// Parsea una línea NDJSON de /api/chat de Ollama. Devuelve null si la línea
// está vacía o no aporta texto. Si la línea no está vacía pero no es JSON
// válido, propaga el error de JSON.parse — el try/catch de streamOllamaChat
// lo captura y corta el stream con error.
//
// Ollama tiene DOS formas de devolver el razonamiento de los modelos que
// piensan: el campo `message.thinking` (API nueva) o etiquetas <think>
// embebidas en `message.content` (modelos viejos y algunos GGUF de la
// comunidad). Acá se resuelve la primera; la segunda la desarma el
// ThinkingSplitter en streamOllamaChat, porque necesita estado entre chunks.
// Además, cuando Ollama falla DESPUÉS de haber empezado a responder (se
// quedó sin memoria, se descargó el modelo), no puede cambiar el status HTTP
// —ya mandó un 200— así que mete una línea suelta `{"error":"..."}` en el
// medio del NDJSON. Si se ignorara, el chat cortaría a mitad de frase sin
// decir por qué; por eso acá se convierte en una excepción.
export function parseNdjsonLine(line: string): OllamaDelta | null {
  if (!line.trim()) return null;
  const chunk = JSON.parse(line) as {
    message?: { content?: string; thinking?: string };
    error?: string;
    done?: boolean;
  };

  if (typeof chunk.error === "string" && chunk.error) {
    throw new Error(`Ollama cortó la respuesta: ${chunk.error}`);
  }

  const content = chunk.message?.content ?? "";
  const thinking = chunk.message?.thinking ?? "";
  if (!content && !thinking) return null;
  return { content, thinking };
}

export type StreamOptions = {
  // Corta la generación cuando el usuario aprieta "Detener".
  signal?: AbortSignal;
};

// Llama a Ollama /api/chat en streaming y va emitiendo deltas ya separados
// en texto visible y razonamiento. Es un async generator y no un
// ReadableStream para que la ruta pueda mezclar estos deltas con sus propios
// eventos (fuentes de búsqueda, avisos de progreso) en un solo stream NDJSON.
export async function* streamOllamaChat(
  model: string,
  messages: OllamaChatMessage[],
  options: StreamOptions = {}
): AsyncGenerator<OllamaDelta> {
  const response = await fetch(`${getBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Ollama respondió ${response.status}: ${text || "sin cuerpo"}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const splitter = new ThinkingSplitter();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const delta = parseNdjsonLine(line);
        if (delta) yield applySplitter(splitter, delta);
      }
    }

    // Ollama no siempre cierra el último chunk con "\n": si quedó algo en el
    // buffer es la última línea NDJSON y hay que procesarla, o se pierde el
    // final de la respuesta.
    if (buffer.trim()) {
      const delta = parseNdjsonLine(buffer);
      if (delta) yield applySplitter(splitter, delta);
    }

    // Lo que el splitter haya retenido esperando cerrar una etiqueta.
    const rest = splitter.flush();
    if (rest.content || rest.thinking) yield rest;
  } finally {
    reader.cancel().catch(() => {});
  }
}

function applySplitter(splitter: ThinkingSplitter, delta: OllamaDelta): OllamaDelta {
  // El razonamiento que ya vino en su propio campo no pasa por el splitter:
  // no lleva etiquetas que desarmar.
  const split = delta.content ? splitter.push(delta.content) : { content: "", thinking: "" };
  return {
    content: split.content,
    thinking: delta.thinking + split.thinking,
  };
}

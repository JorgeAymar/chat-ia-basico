// Protocolo de streaming entre POST /api/chat y el cliente.
//
// Antes el endpoint devolvía texto plano y el cliente lo concatenaba tal cual.
// Eso alcanzaba cuando lo único que viajaba eran tokens, pero ahora en el
// mismo stream conviven cuatro cosas distintas: el texto de la respuesta, el
// razonamiento del modelo (que va plegado y aparte), las fuentes de la
// búsqueda web y los avisos de progreso. Con texto plano no hay forma de
// distinguirlos, así que el stream pasa a ser NDJSON: una línea = un evento.
//
// Se eligió NDJSON y no SSE porque no necesitamos reconexión automática ni
// nombres de evento, y NDJSON se parsea con dos líneas de código sobre el
// mismo ReadableStream que ya teníamos.

export type Source = {
  title: string;
  url: string;
  snippet: string;
};

export type ChatEvent =
  // Texto de la respuesta visible.
  | { type: "token"; text: string }
  // Razonamiento del modelo: se muestra plegado y NO se reinyecta como
  // contexto en los turnos siguientes.
  | { type: "thinking"; text: string }
  // Resultados web usados para responder. Llega antes del primer token.
  | { type: "sources"; sources: Source[] }
  // Aviso de progreso para la UI ("Buscando en la web…"). No se persiste.
  | { type: "status"; text: string }
  // Cuánto duró el razonamiento. Se manda apenas arranca el contenido
  // visible —y no al final de la respuesta— para que el encabezado del
  // bloque pase de "Pensando…" a "Pensó N s" mientras todavía se stremea.
  | { type: "thinking-done"; ms: number }
  // Error a mitad de stream: el HTTP ya respondió 200, así que no se puede
  // usar el status code para avisar.
  | { type: "error"; message: string };

export function encodeEvent(event: ChatEvent): string {
  return JSON.stringify(event) + "\n";
}

// Decodificador con buffer de líneas: un chunk de red puede cortar una línea
// JSON por la mitad, o traer varias líneas juntas. Se guarda el resto
// incompleto hasta que llegue su "\n".
export function createEventDecoder() {
  let buffer = "";

  return function decode(chunk: string): ChatEvent[] {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    const events: ChatEvent[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as ChatEvent);
      } catch {
        // Línea corrupta: se ignora en vez de romper todo el stream.
      }
    }
    return events;
  };
}

// Texto del encabezado del bloque de razonamiento ya terminado. Vive acá y no
// en el componente para poder testear el formateo sin montar React.
//
// Se redondea a segundos porque la precisión al milisegundo no le sirve a
// nadie y encima cambiaría el ancho del encabezado en cada render. Los
// valores absurdos (negativos, NaN) se tratan como "instantáneo": pueden
// venir de un reloj que saltó hacia atrás o de una fila vieja mal migrada, y
// mostrar "Pensó -3 s" sería peor que no mostrar nada.
export function formatThinkingDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return "Pensó menos de un segundo";

  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `Pensó ${totalSeconds} s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `Pensó ${minutes} min` : `Pensó ${minutes} min ${seconds} s`;
}

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

// Cuánto del final del buffer podría ser el comienzo de `tag` cortado por la
// mitad. Ej: buffer "hola <thi" con tag "<think>" devuelve 4, porque "<thi"
// puede terminar siendo "<think>" cuando llegue el chunk siguiente.
export function partialTagLength(buffer: string, tag: string): number {
  const max = Math.min(tag.length - 1, buffer.length);
  for (let n = max; n > 0; n--) {
    if (buffer.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

// Separa el razonamiento del contenido cuando el modelo lo emite inline como
// <think>…</think> (deepseek-r1, qwen3 y compañía) en vez de mandarlo en el
// campo `thinking` de la API de Ollama.
//
// El problema real es que las etiquetas llegan partidas entre chunks: "<th"
// en uno y "ink>" en el siguiente. Por eso nunca se emite la cola del buffer
// que todavía podría ser el principio de una etiqueta — se retiene hasta el
// chunk siguiente, o hasta flush().
export class ThinkingSplitter {
  private buffer = "";
  private inside = false;

  push(chunk: string): { content: string; thinking: string } {
    this.buffer += chunk;
    let content = "";
    let thinking = "";

    for (;;) {
      const tag = this.inside ? CLOSE_TAG : OPEN_TAG;
      const index = this.buffer.indexOf(tag);

      if (index !== -1) {
        const before = this.buffer.slice(0, index);
        if (this.inside) thinking += before;
        else content += before;
        this.buffer = this.buffer.slice(index + tag.length);
        this.inside = !this.inside;
        continue;
      }

      const hold = partialTagLength(this.buffer, tag);
      const emit = this.buffer.slice(0, this.buffer.length - hold);
      this.buffer = this.buffer.slice(this.buffer.length - hold);
      if (this.inside) thinking += emit;
      else content += emit;
      break;
    }

    return { content, thinking };
  }

  // Vacía lo que haya quedado retenido. Si el stream terminó a mitad de un
  // bloque de razonamiento (modelo cortado), lo que sobra es razonamiento.
  flush(): { content: string; thinking: string } {
    const rest = this.buffer;
    this.buffer = "";
    return this.inside
      ? { content: "", thinking: rest }
      : { content: rest, thinking: "" };
  }

  get isInsideThinking(): boolean {
    return this.inside;
  }
}

// Versión no-streaming del splitter, para texto ya completo (mensajes viejos
// guardados en la base antes de que existiera la columna `thinking`).
export function splitThinking(text: string): { content: string; thinking: string } {
  const splitter = new ThinkingSplitter();
  const streamed = splitter.push(text);
  const rest = splitter.flush();
  return {
    content: streamed.content + rest.content,
    thinking: streamed.thinking + rest.thinking,
  };
}

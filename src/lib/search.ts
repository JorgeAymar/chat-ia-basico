import type { Source } from "./stream";

// Búsqueda web contra una instancia local de SearXNG.
//
// SearXNG es un metabuscador self-hosted: corre en el mismo docker-compose
// que Postgres y consulta Google/Bing/DuckDuckGo por vos. Se eligió por sobre
// Brave o Tavily porque no necesita API key ni cuenta, y mantiene la premisa
// de la app: lo único que sale de la máquina es la consulta, no tu identidad.
//
// Dos cosas hay que habilitar sí o sí en searxng/settings.yml, o esto
// devuelve 403 (están explicadas en ese archivo):
//   - search.formats: incluir "json" (por defecto SearXNG solo sirve HTML)
//   - server.limiter: false (el anti-bot bloquea las llamadas programáticas)

export function getSearxngUrl(): string {
  return (process.env.SEARXNG_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
}

export const SEARCH_TIMEOUT_MS = 8_000;
export const MAX_RESULTS = 6;
const MAX_SNIPPET_CHARS = 400;

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
};

export class SearchError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SearchError";
    this.code = code;
  }
}

// Se queda con el mejor resultado por dominio. Sin esto, una búsqueda sobre
// una librería devuelve seis páginas del mismo sitio de docs y el modelo
// termina con una sola perspectiva repetida seis veces.
export function dedupeByDomain(results: Source[], max: number): Source[] {
  const seen = new Set<string>();
  const output: Source[] = [];

  for (const result of results) {
    let domain: string;
    try {
      domain = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    output.push(result);
    if (output.length >= max) break;
  }

  return output;
}

export function normalizeResults(raw: unknown, max = MAX_RESULTS): Source[] {
  const results = (raw as { results?: SearxngResult[] })?.results ?? [];
  const mapped: Source[] = [];

  for (const item of results) {
    if (!item?.url || !item?.title) continue;
    if (!/^https?:\/\//.test(item.url)) continue;
    const snippet = (item.content ?? "").replace(/\s+/g, " ").trim();
    mapped.push({
      title: item.title.trim(),
      url: item.url,
      snippet:
        snippet.length > MAX_SNIPPET_CHARS
          ? `${snippet.slice(0, MAX_SNIPPET_CHARS)}…`
          : snippet,
    });
  }

  return dedupeByDomain(mapped, max);
}

export async function searchWeb(query: string, max = MAX_RESULTS): Promise<Source[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL("/search", getSearxngUrl());
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("safesearch", "0");
  url.searchParams.set("language", "es");
  // Google y Startpage devuelven captcha casi de entrada cuando los consulta
  // un servidor; estos tres aguantan bien el uso programático.
  url.searchParams.set("engines", "duckduckgo,brave,mojeek");

  let response: Response;
  try {
    response = await fetch(url, {
      // Aunque se pida JSON, el filtro http_accept del limiter exige que
      // "text/html" esté en el Accept, y el filtro http_user_agent bloquea
      // tanto los agentes conocidos de scripts como la ausencia de header.
      // Con limiter: false nada de esto aplica, pero no cuesta nada mandarlo.
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) orion-chat/1.0",
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const aborted = (error as Error)?.name === "TimeoutError";
    throw new SearchError(
      aborted
        ? `La búsqueda tardó más de ${SEARCH_TIMEOUT_MS / 1000}s y se canceló.`
        : `No se pudo conectar con SearXNG en ${getSearxngUrl()}. ¿Está levantado (docker compose up -d)?`,
      aborted ? "TIMEOUT" : "UNREACHABLE"
    );
  }

  // 403 y 429 tienen causas distintas y se confunden todo el tiempo:
  // el 403 lo tira webapp.py cuando "json" no está en search.formats, y el
  // 429 lo tira el limiter anti-bot. El mensaje apunta al arreglo correcto.
  if (response.status === 403) {
    throw new SearchError(
      "SearXNG devolvió 403: falta agregar 'json' a search.formats en searxng/settings.yml y reiniciar el contenedor.",
      "FORMAT_DISABLED"
    );
  }
  if (response.status === 429) {
    throw new SearchError(
      "SearXNG devolvió 429: el limiter está bloqueando las llamadas. Poné server.limiter: false en searxng/settings.yml.",
      "RATE_LIMITED"
    );
  }
  if (!response.ok) {
    throw new SearchError(`SearXNG respondió ${response.status}.`, "BAD_STATUS");
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    throw new SearchError("SearXNG devolvió una respuesta que no es JSON.", "BAD_BODY");
  }

  return normalizeResults(data, max);
}

// Arma el bloque de contexto que se le inyecta al modelo. Los resultados van
// numerados y la instrucción de citar usa esos mismos números: así el [2] que
// escriba el modelo se puede mapear de vuelta a una URL concreta en la UI
// (lo hace linkCitations en components/Markdown.tsx).
export function buildSearchContext(query: string, sources: Source[]): string {
  if (sources.length === 0) return "";

  const list = sources
    .map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.snippet}`)
    .join("\n\n");

  return [
    `Resultados de una búsqueda web hecha recién para "${query}":`,
    "",
    list,
    "",
    "Instrucciones para usar estos resultados:",
    "- Respondé apoyándote en ellos y citá con marcadores [1], [2], etc., justo después de la afirmación que sale de esa fuente.",
    "- Los resultados son extractos, no páginas completas: si no alcanzan para responder, decilo en vez de rellenar.",
    "- Si tu conocimiento previo contradice los resultados, priorizá los resultados: son más recientes.",
    "- No cites fuentes que no usaste.",
  ].join("\n");
}

// Convierte el mensaje del usuario en algo que sirva como consulta de
// buscador. Es deliberadamente barato y sin LLM: pedirle al modelo local que
// reescriba la query agrega varios segundos antes del primer token, y para
// preguntas normales recortar el relleno conversacional alcanza.
export function toSearchQuery(message: string): string {
  return message
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(hola|che|dale|por favor|porfa|decime|contame|explicame|explicáme|me podés decir|podés decirme|quiero saber|necesito saber)\b[,:\s]*/i,
      ""
    )
    .replace(/^[¿?]+/, "")
    .replace(/[?¿]+$/, "")
    .slice(0, 300)
    .trim();
}

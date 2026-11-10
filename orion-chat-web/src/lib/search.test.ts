import {
  dedupeByDomain,
  normalizeResults,
  buildSearchContext,
  toSearchQuery,
  getSearxngUrl,
  searchWeb,
  SearchError,
  MAX_RESULTS,
} from "./search";
import type { Source } from "./stream";

function source(url: string, title = "t", snippet = "s"): Source {
  return { title, url, snippet };
}

describe("dedupeByDomain", () => {
  it("se queda con el primer resultado de cada dominio y descarta los siguientes", () => {
    const out = dedupeByDomain(
      [
        source("https://docs.dev/a", "primero"),
        source("https://docs.dev/b", "segundo"),
        source("https://otro.dev/c", "tercero"),
      ],
      10
    );
    expect(out.map((s) => s.title)).toEqual(["primero", "tercero"]);
  });

  it("trata www.sitio.com y sitio.com como el mismo dominio", () => {
    const out = dedupeByDomain(
      [source("https://www.ejemplo.com/a", "con www"), source("https://ejemplo.com/b", "sin www")],
      10
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("con www");
  });

  it("corta al llegar al máximo pedido", () => {
    const out = dedupeByDomain(
      [source("https://a.com/1"), source("https://b.com/1"), source("https://c.com/1")],
      2
    );
    expect(out).toHaveLength(2);
  });

  it("saltea las URLs que no se pueden parsear en vez de lanzar", () => {
    // SearXNG a veces devuelve URLs relativas o rotas de algún motor; una sola
    // no debería tirar abajo la búsqueda entera.
    const out = dedupeByDomain(
      [source("no-es-una-url"), source("https://valido.com/x", "válido")],
      10
    );
    expect(out.map((s) => s.title)).toEqual(["válido"]);
  });

  it("devuelve una lista vacía si ninguna URL es válida", () => {
    expect(dedupeByDomain([source("////"), source("")], 5)).toEqual([]);
  });
});

describe("normalizeResults", () => {
  it("descarta resultados sin título o sin URL", () => {
    const out = normalizeResults({
      results: [
        { title: "sin url", content: "x" },
        { url: "https://a.com", content: "x" },
        { title: "completo", url: "https://b.com", content: "x" },
      ],
    });
    expect(out.map((s) => s.title)).toEqual(["completo"]);
  });

  it("rechaza esquemas que no sean http o https", () => {
    // `javascript:` acá no es teórico: el título y la URL terminan renderizados
    // como enlace en la UI, así que dejar pasar el esquema es una inyección.
    const out = normalizeResults({
      results: [
        { title: "malicioso", url: "javascript:alert(1)", content: "x" },
        { title: "ftp", url: "ftp://archivos.com/x", content: "x" },
        { title: "bueno", url: "https://ok.com", content: "x" },
      ],
    });
    expect(out.map((s) => s.title)).toEqual(["bueno"]);
  });

  it("colapsa los espacios y saltos de línea del snippet", () => {
    const out = normalizeResults({
      results: [{ title: "t", url: "https://a.com", content: "  hola\n\n  mundo\t raro  " }],
    });
    expect(out[0].snippet).toBe("hola mundo raro");
  });

  it("trunca los snippets largos y marca el corte con puntos suspensivos", () => {
    const out = normalizeResults({
      results: [{ title: "t", url: "https://a.com", content: "x".repeat(600) }],
    });
    expect(out[0].snippet).toHaveLength(401);
    expect(out[0].snippet.endsWith("…")).toBe(true);
  });

  it("deja el snippet vacío si el resultado no trae contenido", () => {
    const out = normalizeResults({ results: [{ title: "t", url: "https://a.com" }] });
    expect(out[0].snippet).toBe("");
  });

  it("devuelve una lista vacía si la respuesta no tiene la forma esperada", () => {
    expect(normalizeResults(null)).toEqual([]);
    expect(normalizeResults({})).toEqual([]);
  });

  it("aplica la deduplicación por dominio y el máximo", () => {
    const out = normalizeResults(
      {
        results: [
          { title: "a1", url: "https://a.com/1", content: "" },
          { title: "a2", url: "https://a.com/2", content: "" },
          { title: "b", url: "https://b.com", content: "" },
          { title: "c", url: "https://c.com", content: "" },
        ],
      },
      2
    );
    expect(out.map((s) => s.title)).toEqual(["a1", "b"]);
  });
});

describe("buildSearchContext", () => {
  it("devuelve cadena vacía cuando no hay fuentes", () => {
    expect(buildSearchContext("lo que sea", [])).toBe("");
  });

  it("numera las fuentes desde [1] e incluye título, URL y snippet", () => {
    const context = buildSearchContext("capital de francia", [
      source("https://uno.com", "Uno", "snippet uno"),
      source("https://dos.com", "Dos", "snippet dos"),
    ]);
    expect(context).toContain("[1] Uno");
    expect(context).toContain("URL: https://uno.com");
    expect(context).toContain("snippet uno");
    expect(context).toContain("[2] Dos");
    expect(context).toContain("URL: https://dos.com");
    expect(context).toContain("snippet dos");
    expect(context).not.toContain("[0]");
    expect(context).toContain("capital de francia");
  });
});

describe("toSearchQuery", () => {
  it("saca el saludo o muletilla del principio", () => {
    expect(toSearchQuery("hola, cuánto mide el Aconcagua")).toBe("cuánto mide el Aconcagua");
    expect(toSearchQuery("decime el precio del dólar")).toBe("el precio del dólar");
    expect(toSearchQuery("por favor: noticias de hoy")).toBe("noticias de hoy");
  });

  it("no saca la muletilla si está en el medio de la frase", () => {
    expect(toSearchQuery("qué significa che en Argentina")).toBe("qué significa che en Argentina");
  });

  it("saca los signos de pregunta de ambos extremos", () => {
    expect(toSearchQuery("¿cuál es la capital de Francia?")).toBe("cuál es la capital de Francia");
  });

  it("colapsa los espacios y saltos de línea", () => {
    expect(toSearchQuery("  qué   es\nel   ARN  ")).toBe("qué es el ARN");
  });

  it("recorta la consulta a 300 caracteres", () => {
    const largo = "a".repeat(500);
    expect(toSearchQuery(largo)).toHaveLength(300);
  });

  it("devuelve cadena vacía si el mensaje era solo relleno", () => {
    expect(toSearchQuery("  hola  ")).toBe("");
  });
});

describe("getSearxngUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Copia por test: la URL se lee de process.env en cada llamada, así que
    // un test que la pisa contaminaría a los demás.
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("usa el default local cuando no hay variable de entorno", () => {
    delete process.env.SEARXNG_BASE_URL;
    expect(getSearxngUrl()).toBe("http://localhost:8080");
  });

  it("le saca la barra final a la URL configurada", () => {
    process.env.SEARXNG_BASE_URL = "http://buscador.local:9000///";
    expect(getSearxngUrl()).toBe("http://buscador.local:9000");
  });

  it("deja intacta una URL que ya viene sin barra final", () => {
    process.env.SEARXNG_BASE_URL = "https://searx.ejemplo.com";
    expect(getSearxngUrl()).toBe("https://searx.ejemplo.com");
  });
});

describe("searchWeb", () => {
  const realFetch = global.fetch;

  function mockFetch(response: Partial<Response>): jest.Mock {
    const fn = jest.fn().mockResolvedValue(response as Response);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("no llama a la red si la consulta viene vacía", async () => {
    const fn = mockFetch({ ok: true, status: 200 });
    await expect(searchWeb("   ")).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("traduce el 403 de SearXNG a FORMAT_DISABLED", async () => {
    // 403 = el formato json no está habilitado en settings.yml; el código
    // distingue esto del 429 porque el arreglo es otro.
    mockFetch({ ok: false, status: 403 });
    await expect(searchWeb("algo")).rejects.toMatchObject({
      name: "SearchError",
      code: "FORMAT_DISABLED",
    });
  });

  it("traduce el 429 de SearXNG a RATE_LIMITED", async () => {
    mockFetch({ ok: false, status: 429 });
    const error = await searchWeb("algo").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchError);
    expect((error as SearchError).code).toBe("RATE_LIMITED");
    expect((error as SearchError).message).toContain("limiter");
  });

  it("cualquier otro estado no ok cae en BAD_STATUS", async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(searchWeb("algo")).rejects.toMatchObject({ code: "BAD_STATUS" });
  });

  it("un cuerpo que no es JSON da BAD_BODY en vez de propagar el error del parser", async () => {
    mockFetch({ ok: true, status: 200, json: () => Promise.reject(new Error("no json")) });
    await expect(searchWeb("algo")).rejects.toMatchObject({ code: "BAD_BODY" });
  });

  it("un fallo de conexión da UNREACHABLE", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("fetch failed")) as unknown as typeof fetch;
    await expect(searchWeb("algo")).rejects.toMatchObject({ code: "UNREACHABLE" });
  });

  it("un timeout da TIMEOUT y no UNREACHABLE", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    global.fetch = jest.fn().mockRejectedValue(timeout) as unknown as typeof fetch;
    await expect(searchWeb("algo")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("normaliza la respuesta exitosa y pide json a SearXNG", async () => {
    const fn = mockFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          results: [
            { title: "Uno", url: "https://uno.com", content: "hola   mundo" },
            { title: "Sin url", content: "x" },
          ],
        }),
    });
    await expect(searchWeb("gatos")).resolves.toEqual([
      { title: "Uno", url: "https://uno.com", snippet: "hola mundo" },
    ]);
    const requested = (fn.mock.calls[0][0] as URL).toString();
    expect(requested).toContain("format=json");
    expect(requested).toContain("q=gatos");
  });

  it("MAX_RESULTS es el tope por defecto de fuentes devueltas", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          results: Array.from({ length: MAX_RESULTS + 4 }, (_, i) => ({
            title: `t${i}`,
            url: `https://sitio-${i}.com`,
            content: "",
          })),
        }),
    });
    await expect(searchWeb("muchos")).resolves.toHaveLength(MAX_RESULTS);
  });
});

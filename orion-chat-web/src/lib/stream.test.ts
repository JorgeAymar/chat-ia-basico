import {
  ThinkingSplitter,
  splitThinking,
  partialTagLength,
  createEventDecoder,
  encodeEvent,
  formatThinkingDuration,
} from "./stream";

describe("partialTagLength", () => {
  it("detecta el prefijo de una etiqueta cortada al final del buffer", () => {
    expect(partialTagLength("hola <thi", "<think>")).toBe(4);
    expect(partialTagLength("hola <", "<think>")).toBe(1);
  });

  it("devuelve 0 cuando el final del buffer no puede ser una etiqueta", () => {
    expect(partialTagLength("hola mundo", "<think>")).toBe(0);
    expect(partialTagLength("", "<think>")).toBe(0);
  });

  it("no reclama la etiqueta completa como parcial", () => {
    // Una etiqueta entera la resuelve indexOf, no el retenedor de parciales.
    expect(partialTagLength("<think>", "<think>")).toBe(0);
  });
});

describe("ThinkingSplitter", () => {
  it("separa razonamiento de contenido en un solo chunk", () => {
    const splitter = new ThinkingSplitter();
    const out = splitter.push("<think>déjame ver</think>La respuesta es 4");
    expect(out.thinking).toBe("déjame ver");
    expect(out.content).toBe("La respuesta es 4");
  });

  it("maneja etiquetas partidas entre chunks", () => {
    const splitter = new ThinkingSplitter();
    // "<think>" llega en tres pedazos, como pasa de verdad con Ollama.
    const a = splitter.push("<th");
    const b = splitter.push("ink>razo");
    const c = splitter.push("nando</thi");
    const d = splitter.push("nk>listo");

    expect(a.content + b.content + c.content + d.content).toBe("listo");
    expect(a.thinking + b.thinking + c.thinking + d.thinking).toBe("razonando");
  });

  it("no emite texto que todavía podría ser el inicio de una etiqueta", () => {
    const splitter = new ThinkingSplitter();
    const out = splitter.push("hola <thi");
    // "<thi" queda retenido: si se emitiera y después llegara "nk>", el
    // usuario vería la etiqueta cruda en pantalla.
    expect(out.content).toBe("hola ");
    expect(splitter.flush().content).toBe("<thi");
  });

  it("trata como razonamiento lo que quede si el stream corta adentro del bloque", () => {
    const splitter = new ThinkingSplitter();
    // Adentro del bloque el texto sale como razonamiento apenas llega; lo
    // único que queda retenido es el posible inicio de "</think>".
    const pushed = splitter.push("<think>a medio pensar</th");
    expect(splitter.isInsideThinking).toBe(true);
    expect(pushed.thinking).toBe("a medio pensar");
    expect(pushed.content).toBe("");

    const rest = splitter.flush();
    expect(rest.thinking).toBe("</th");
    expect(rest.content).toBe("");
  });

  it("deja pasar intacto el texto sin etiquetas", () => {
    const splitter = new ThinkingSplitter();
    const out = splitter.push("respuesta normal sin razonamiento");
    expect(out.content).toBe("respuesta normal sin razonamiento");
    expect(out.thinking).toBe("");
  });

  it("no confunde un < suelto del contenido con una etiqueta", () => {
    const splitter = new ThinkingSplitter();
    const a = splitter.push("if (a < b) {");
    const b = splitter.flush();
    expect(a.content + b.content).toBe("if (a < b) {");
    expect(a.thinking + b.thinking).toBe("");
  });
});

describe("splitThinking", () => {
  it("separa un texto ya completo", () => {
    const { content, thinking } = splitThinking("<think>mmm</think>Hola");
    expect(thinking).toBe("mmm");
    expect(content).toBe("Hola");
  });

  it("devuelve todo como contenido si no hay bloque de razonamiento", () => {
    const { content, thinking } = splitThinking("Hola");
    expect(content).toBe("Hola");
    expect(thinking).toBe("");
  });
});

describe("formatThinkingDuration", () => {
  it("no muestra '0 s' cuando el razonamiento fue instantáneo", () => {
    expect(formatThinkingDuration(1)).toBe("Pensó menos de un segundo");
    expect(formatThinkingDuration(999)).toBe("Pensó menos de un segundo");
  });

  it("muestra segundos redondeados", () => {
    expect(formatThinkingDuration(1000)).toBe("Pensó 1 s");
    expect(formatThinkingDuration(12_000)).toBe("Pensó 12 s");
    expect(formatThinkingDuration(12_400)).toBe("Pensó 12 s");
    expect(formatThinkingDuration(12_600)).toBe("Pensó 13 s");
  });

  it("cruza el minuto sin quedarse en '60 s'", () => {
    // 59,6 s redondea a 60 segundos: tiene que salir como minuto, no "Pensó 60 s".
    expect(formatThinkingDuration(59_600)).toBe("Pensó 1 min");
    expect(formatThinkingDuration(60_000)).toBe("Pensó 1 min");
    expect(formatThinkingDuration(65_000)).toBe("Pensó 1 min 5 s");
    expect(formatThinkingDuration(125_000)).toBe("Pensó 2 min 5 s");
    expect(formatThinkingDuration(120_000)).toBe("Pensó 2 min");
  });

  it("no muestra duraciones absurdas", () => {
    expect(formatThinkingDuration(0)).toBe("Pensó menos de un segundo");
    expect(formatThinkingDuration(-5000)).toBe("Pensó menos de un segundo");
    expect(formatThinkingDuration(Number.NaN)).toBe("Pensó menos de un segundo");
    expect(formatThinkingDuration(Number.POSITIVE_INFINITY)).toBe(
      "Pensó menos de un segundo"
    );
  });
});

describe("createEventDecoder", () => {
  it("junta líneas JSON partidas entre chunks", () => {
    const decode = createEventDecoder();
    expect(decode('{"type":"token","te')).toEqual([]);
    expect(decode('xt":"hola"}\n')).toEqual([{ type: "token", text: "hola" }]);
  });

  it("decodifica varios eventos que llegan en el mismo chunk", () => {
    const decode = createEventDecoder();
    const events = decode(
      encodeEvent({ type: "token", text: "a" }) +
        encodeEvent({ type: "token", text: "b" })
    );
    expect(events).toEqual([
      { type: "token", text: "a" },
      { type: "token", text: "b" },
    ]);
  });

  it("ignora líneas corruptas en vez de romper el stream entero", () => {
    const decode = createEventDecoder();
    const events = decode('esto no es json\n{"type":"token","text":"ok"}\n');
    expect(events).toEqual([{ type: "token", text: "ok" }]);
  });
});

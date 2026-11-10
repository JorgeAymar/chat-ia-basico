import { splitMarkdownBlocks, closeOpenFence } from "./markdown-blocks";

describe("splitMarkdownBlocks", () => {
  it("parte por líneas en blanco", () => {
    expect(splitMarkdownBlocks("uno\n\ndos\n\ntres")).toEqual(["uno", "dos", "tres"]);
  });

  it("colapsa varias líneas en blanco seguidas sin generar bloques vacíos", () => {
    expect(splitMarkdownBlocks("uno\n\n\n\ndos")).toEqual(["uno", "dos"]);
  });

  it("mantiene entero un bloque de código con líneas en blanco adentro", () => {
    const md = "texto\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nfin";
    expect(splitMarkdownBlocks(md)).toEqual([
      "texto",
      "```js\nconst a = 1;\n\nconst b = 2;\n```",
      "fin",
    ]);
  });

  it("no cierra un bloque ``` con una valla ~~~ de adentro", () => {
    const md = "```md\n~~~\nno cierra\n~~~\n```";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("devuelve el bloque de código sin cerrar como un solo bloque", () => {
    const md = "```py\nprint(1)";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("string vacío no produce bloques", () => {
    expect(splitMarkdownBlocks("")).toEqual([]);
    expect(splitMarkdownBlocks("\n\n")).toEqual([]);
  });

  it("mantiene juntas las líneas de una lista", () => {
    const md = "- uno\n- dos\n- tres";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });
});

describe("closeOpenFence", () => {
  it("cierra un bloque de código que quedó abierto a mitad del stream", () => {
    expect(closeOpenFence("```js\nconst a = 1;")).toBe("```js\nconst a = 1;\n```");
  });

  it("deja intacto un bloque ya cerrado", () => {
    const block = "```js\nconst a = 1;\n```";
    expect(closeOpenFence(block)).toBe(block);
  });

  it("deja intacto el texto sin bloques de código", () => {
    expect(closeOpenFence("un párrafo común")).toBe("un párrafo común");
  });

  it("cierra con el mismo carácter de valla con el que abrió", () => {
    expect(closeOpenFence("~~~py\nprint(1)")).toBe("~~~py\nprint(1)\n~~~");
  });

  it("cierra cuando la valla recién se abrió y no hay contenido todavía", () => {
    expect(closeOpenFence("```")).toBe("```\n```");
  });
});

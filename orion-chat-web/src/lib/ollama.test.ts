import { buildOllamaMessage, parseNdjsonLine, type Attachment } from "./ollama";

describe("buildOllamaMessage", () => {
  it("solo texto, sin adjuntos: content = texto, images = undefined", () => {
    const msg = buildOllamaMessage("user", "hola mundo");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hola mundo");
    expect(msg.images).toBeUndefined();
  });

  it("un adjunto de texto: content incluye el texto original + el bloque de archivo adjunto", () => {
    const attachments: Attachment[] = [
      { name: "notas.txt", kind: "text", mimeType: "text/plain", content: "contenido del archivo" },
    ];
    const msg = buildOllamaMessage("user", "revisa esto", attachments);
    expect(msg.content).toContain("revisa esto");
    expect(msg.content).toContain("--- Archivo adjunto: notas.txt ---");
    expect(msg.content).toContain("contenido del archivo");
    expect(msg.content).toContain("--- fin de notas.txt ---");
    expect(msg.images).toBeUndefined();
  });

  it("un adjunto de imagen: images tiene el base64, content no cambia", () => {
    const attachments: Attachment[] = [
      { name: "foto.png", kind: "image", mimeType: "image/png", content: "BASE64DATA" },
    ];
    const msg = buildOllamaMessage("user", "mira la imagen", attachments);
    expect(msg.content).toBe("mira la imagen");
    expect(msg.images).toEqual(["BASE64DATA"]);
  });

  it("adjuntos mixtos (texto + imagen): ambos efectos se aplican", () => {
    const attachments: Attachment[] = [
      { name: "notas.txt", kind: "text", mimeType: "text/plain", content: "texto plano" },
      { name: "foto.png", kind: "image", mimeType: "image/png", content: "IMGBASE64" },
    ];
    const msg = buildOllamaMessage("user", "hola", attachments);
    expect(msg.content).toContain("hola");
    expect(msg.content).toContain("--- Archivo adjunto: notas.txt ---");
    expect(msg.content).toContain("texto plano");
    expect(msg.images).toEqual(["IMGBASE64"]);
  });

  it("attachments undefined explícito: igual que sin adjuntos", () => {
    const msg = buildOllamaMessage("user", "solo texto", undefined);
    expect(msg.content).toBe("solo texto");
    expect(msg.images).toBeUndefined();
  });
});

describe("parseNdjsonLine", () => {
  it("línea JSON válida con message.content devuelve el texto", () => {
    const line = JSON.stringify({ message: { content: "hola" }, done: false });
    expect(parseNdjsonLine(line)).toEqual({ content: "hola", thinking: "" });
  });

  it("el campo thinking de la API nueva de Ollama viaja aparte del contenido", () => {
    const line = JSON.stringify({ message: { thinking: "mmm", content: "" } });
    expect(parseNdjsonLine(line)).toEqual({ content: "", thinking: "mmm" });
  });

  it("línea vacía devuelve null", () => {
    expect(parseNdjsonLine("")).toBeNull();
  });

  it("línea solo con espacios devuelve null", () => {
    expect(parseNdjsonLine("   ")).toBeNull();
  });

  it("línea con message sin content ni thinking devuelve null", () => {
    const line = JSON.stringify({ message: {}, done: true });
    expect(parseNdjsonLine(line)).toBeNull();
  });

  it("línea con JSON inválido lanza", () => {
    expect(() => parseNdjsonLine("{esto no es json")).toThrow();
  });

  it("una línea de error a mitad de stream lanza en vez de pasar desapercibida", () => {
    // Ollama ya mandó HTTP 200, así que avisa del fallo con una línea suelta
    // que solo tiene `error`. Ignorarla haría que el chat corte sin explicar.
    const line = JSON.stringify({ error: "model runner has unexpectedly stopped" });
    expect(() => parseNdjsonLine(line)).toThrow(/model runner has unexpectedly stopped/);
  });
});

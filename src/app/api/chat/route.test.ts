// route.ts importa @/lib/prisma, que a su vez importa el cliente Prisma
// generado (ESM con import.meta, que ts-jest no puede transformar). Como
// estos tests solo ejercitan parseAttachments (una función pura sin
// dependencias de Prisma/Ollama), mockeamos esos módulos para poder cargar
// el archivo sin tocar una base de datos real ni romper la carga del test.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/ollama", () => ({
  isModelAvailable: jest.fn(),
  streamOllamaChat: jest.fn(),
  buildOllamaMessage: jest.fn(),
  getBaseUrl: jest.fn(),
}));
jest.mock("@/lib/settings", () => ({ getSystemPrompt: jest.fn() }));

import {
  parseAttachments,
  MAX_ATTACHMENTS,
  MAX_TEXT_CHARS,
  MAX_IMAGE_BASE64_CHARS,
} from "./route";

describe("parseAttachments", () => {
  it("undefined devuelve []", () => {
    expect(parseAttachments(undefined)).toEqual([]);
  });

  it("null devuelve []", () => {
    expect(parseAttachments(null)).toEqual([]);
  });

  it("no-array devuelve un error", () => {
    const result = parseAttachments({ not: "an array" });
    expect(result).toHaveProperty("error");
  });

  it("más de MAX_ATTACHMENTS devuelve error", () => {
    const raw = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => ({
      name: `file${i}.txt`,
      kind: "text",
      mimeType: "text/plain",
      content: "x",
    }));
    const result = parseAttachments(raw);
    expect(result).toHaveProperty("error");
  });

  it("item con kind inválido devuelve error", () => {
    const raw = [
      { name: "a.txt", kind: "audio", mimeType: "audio/mp3", content: "x" },
    ];
    const result = parseAttachments(raw);
    expect(result).toHaveProperty("error");
  });

  it("item de texto que excede MAX_TEXT_CHARS devuelve error", () => {
    const raw = [
      {
        name: "grande.txt",
        kind: "text",
        mimeType: "text/plain",
        content: "a".repeat(MAX_TEXT_CHARS + 1),
      },
    ];
    const result = parseAttachments(raw);
    expect(result).toHaveProperty("error");
  });

  it("item de imagen que excede MAX_IMAGE_BASE64_CHARS devuelve error", () => {
    const raw = [
      {
        name: "grande.png",
        kind: "image",
        mimeType: "image/png",
        content: "a".repeat(MAX_IMAGE_BASE64_CHARS + 1),
      },
    ];
    const result = parseAttachments(raw);
    expect(result).toHaveProperty("error");
  });

  it("array válido con texto e imagen devuelve el array de Attachment[] tal cual", () => {
    const raw = [
      { name: "notas.txt", kind: "text", mimeType: "text/plain", content: "hola" },
      { name: "foto.png", kind: "image", mimeType: "image/png", content: "BASE64" },
    ];
    const result = parseAttachments(raw);
    expect(result).toEqual([
      { name: "notas.txt", kind: "text", mimeType: "text/plain", content: "hola" },
      { name: "foto.png", kind: "image", mimeType: "image/png", content: "BASE64" },
    ]);
  });
});

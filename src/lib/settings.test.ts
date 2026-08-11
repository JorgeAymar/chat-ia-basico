jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

import { readFile, writeFile } from "node:fs/promises";
import { getSystemPrompt, setSystemPrompt, MAX_SYSTEM_PROMPT_CHARS } from "./settings";

const mockedReadFile = readFile as jest.Mock;
const mockedWriteFile = writeFile as jest.Mock;

const DEFAULT_SYSTEM_PROMPT =
  "Eres un asistente de chat útil, directo y conciso. Responde en español neutro salvo que te pidan explícitamente otro idioma.";

describe("getSystemPrompt", () => {
  beforeEach(() => {
    mockedReadFile.mockReset();
  });

  it("devuelve el contenido trimeado si el archivo existe", async () => {
    mockedReadFile.mockResolvedValue("  hola, soy el prompt del sistema  \n");
    const result = await getSystemPrompt();
    expect(result).toBe("hola, soy el prompt del sistema");
  });

  it("devuelve el prompt default si el archivo no existe (readFile rechaza)", async () => {
    mockedReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await getSystemPrompt();
    expect(result).toBe(DEFAULT_SYSTEM_PROMPT);
  });
});

describe("setSystemPrompt", () => {
  beforeEach(() => {
    mockedWriteFile.mockReset();
    mockedWriteFile.mockResolvedValue(undefined);
  });

  it("trunca el contenido a MAX_SYSTEM_PROMPT_CHARS si es más largo", async () => {
    const longContent = "a".repeat(MAX_SYSTEM_PROMPT_CHARS + 500);
    await setSystemPrompt(longContent);
    const [, written] = mockedWriteFile.mock.calls[0];
    expect(written).toHaveLength(MAX_SYSTEM_PROMPT_CHARS);
    expect(written).toBe("a".repeat(MAX_SYSTEM_PROMPT_CHARS));
  });

  it("escribe el contenido tal cual si es más corto que el máximo", async () => {
    const shortContent = "prompt corto";
    await setSystemPrompt(shortContent);
    const [, written] = mockedWriteFile.mock.calls[0];
    expect(written).toBe(shortContent);
  });
});

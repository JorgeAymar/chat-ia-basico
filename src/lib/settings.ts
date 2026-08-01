import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "SYSTEM_PROMPT.md");
const DEFAULT_SYSTEM_PROMPT =
  "Sos un asistente de chat útil, directo y conciso. Respondé en español salvo que te pidan explícitamente otro idioma.";
const MAX_SYSTEM_PROMPT_CHARS = 20_000;

export async function getSystemPrompt(): Promise<string> {
  try {
    const content = await readFile(SYSTEM_PROMPT_PATH, "utf-8");
    return content.trim();
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

export async function setSystemPrompt(content: string): Promise<void> {
  const trimmed = content.slice(0, MAX_SYSTEM_PROMPT_CHARS);
  await writeFile(SYSTEM_PROMPT_PATH, trimmed, "utf-8");
}

export { MAX_SYSTEM_PROMPT_CHARS };

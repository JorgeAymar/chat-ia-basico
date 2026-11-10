import { extractText } from "unpdf";
import mammoth from "mammoth";

// Extracción de texto de PDF y DOCX del lado servidor.
//
// El navegador solo sabe leer texto plano e imágenes, así que los PDF y los
// .docx se suben crudos a /api/upload y se convierten acá antes de que el
// modelo los vea.
//
// Por qué `unpdf` y no `pdf-parse`/`pdfjs-dist`: es el único que funciona sin
// configurar un worker ni polyfills de DOM bajo Turbopack. `pdf-parse` además
// intenta leer un PDF de prueba propio al importarse y explota al bundlear.

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_PDF_PAGES = 150;
// Igual que MAX_TEXT_CHARS en /api/chat: así el recorte lo hace este módulo
// —que puede cortar por página— y nunca se dispara el rechazo duro del chat.
export const MAX_DOC_CHARS = 100_000;
export const PDF_TIMEOUT_MS = 30_000;
// Debajo de esto asumimos que el PDF no tiene capa de texto.
const MIN_CHARS_PER_PAGE = 20;

export type ExtractedDocument = {
  name: string;
  text: string;
  totalPages: number;
  includedPages: number;
  truncated: boolean;
  warnings: string[];
};

export class DocumentError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "DocumentError";
    this.code = code;
  }
}

// Limpia el ruido típico de los PDF (guiones blandos del justificado,
// caracteres de control) sin aplastar la estructura de párrafos.
function clean(input: string): string {
  return input
    // Guion blando: invisible en pantalla, pero el modelo lo lee como parte
    // de la palabra y parte términos al medio.
    .replace(/\u00AD/g, "")
    // Caracteres de control (menos \t \n \r), basura frecuente en PDFs.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Corta en el último límite natural disponible: párrafo, línea o palabra.
// Un slice() pelado parte palabras al medio y el modelo lee basura.
export function cutAtBoundary(block: string, limit: number): string {
  if (block.length <= limit) return block;
  const head = block.slice(0, limit);
  for (const separator of ["\n\n", "\n", " "]) {
    const index = head.lastIndexOf(separator);
    // Solo si el corte no deja menos de la mitad de lo que entraba: si no,
    // se pierde demasiado texto por respetar el límite.
    if (index > limit * 0.5) return head.slice(0, index).trimEnd();
  }
  return head.trimEnd();
}

// Mete bloques enteros mientras entren y recorta solo el último. Deja una
// marca explícita del truncado para que el modelo sepa que no tiene todo el
// documento y no afirme cosas sobre lo que no leyó.
export function assembleBlocks(
  blocks: string[],
  label: (index: number) => string,
  maxChars: number
): { text: string; included: number; truncated: boolean } {
  const parts: string[] = [];
  let used = 0;
  let included = 0;

  for (let i = 0; i < blocks.length; i++) {
    const body = blocks[i];
    if (!body) {
      // Página en blanco: cuenta como incluida pero no ocupa lugar.
      included++;
      continue;
    }

    const prefix = label(i);
    const chunk = prefix ? `${prefix}\n${body}` : body;
    const remaining = maxChars - used;
    if (remaining <= 0) break;

    if (chunk.length <= remaining) {
      parts.push(chunk);
      used += chunk.length + 2;
      included++;
    } else {
      const partial = cutAtBoundary(chunk, remaining);
      if (partial.trim().length > prefix.length + 20) {
        parts.push(partial);
      }
      break;
    }
  }

  const truncated = included < blocks.length;
  let text = parts.join("\n\n");
  if (truncated) {
    text += `\n\n[… documento truncado: se incluyeron ${included} de ${blocks.length} páginas/secciones …]`;
  }
  return { text, included, truncated };
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new DocumentError(`${what} tardó demasiado`, "TIMEOUT")), ms)
    ),
  ]);
}

export async function extractPdf(buffer: Buffer, name: string): Promise<ExtractedDocument> {
  let totalPages: number;
  let pages: string[];

  try {
    // PDF.js se queda con el ArrayBuffer (lo "transfiere"): si se reusa el
    // mismo buffer en una segunda llamada, tira DataCloneError. Por eso
    // siempre una copia nueva.
    const result = await withTimeout(
      extractText(new Uint8Array(buffer), { mergePages: false }),
      PDF_TIMEOUT_MS,
      "La lectura del PDF"
    );
    totalPages = result.totalPages;
    pages = (result.text as string[]).map(clean);
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    const kind = (error as { name?: string })?.name;
    if (kind === "PasswordException") {
      throw new DocumentError(`"${name}" está protegido con contraseña.`, "PDF_ENCRYPTED");
    }
    if (kind === "InvalidPDFException") {
      throw new DocumentError(`"${name}" no es un PDF válido o está dañado.`, "PDF_INVALID");
    }
    throw new DocumentError(`No se pudo leer "${name}".`, "PDF_UNREADABLE");
  }

  if (pages.length > MAX_PDF_PAGES) {
    pages = pages.slice(0, MAX_PDF_PAGES);
  }

  // Un PDF escaneado devuelve páginas vacías SIN error. Mandar "" al modelo
  // es peor que fallar: responde inventando sobre un documento que no leyó.
  const totalChars = pages.reduce((acc, page) => acc + page.length, 0);
  if (totalChars < MIN_CHARS_PER_PAGE * pages.length) {
    throw new DocumentError(
      `"${name}" no tiene capa de texto (parece escaneado o hecho de imágenes). Pasalo por OCR antes de adjuntarlo.`,
      "PDF_NO_TEXT_LAYER"
    );
  }

  const { text, included, truncated } = assembleBlocks(
    pages,
    (i) => `[página ${i + 1}]`,
    MAX_DOC_CHARS
  );

  const warnings: string[] = [];
  if (totalPages > MAX_PDF_PAGES) {
    warnings.push(`Solo se procesaron las primeras ${MAX_PDF_PAGES} de ${totalPages} páginas.`);
  }
  const blank = pages.filter((page) => !page).length;
  if (blank > 0) warnings.push(`${blank} página(s) sin texto (probablemente imágenes).`);

  return { name, text, totalPages, includedPages: included, truncated, warnings };
}

export async function extractDocx(buffer: Buffer, name: string): Promise<ExtractedDocument> {
  let value: string;
  try {
    // En Node, mammoth solo acepta { buffer } o { path }: { arrayBuffer } es
    // exclusivo del navegador y falla con "Could not find file in options".
    const result = await mammoth.extractRawText({ buffer });
    value = result.value;
  } catch (error) {
    const message = String((error as Error)?.message ?? "");
    if (message.includes("central directory") || message.includes("zip")) {
      throw new DocumentError(
        `"${name}" no es un .docx válido (¿es un .doc viejo o un archivo renombrado?).`,
        "DOCX_INVALID"
      );
    }
    throw new DocumentError(`No se pudo leer "${name}".`, "DOCX_UNREADABLE");
  }

  const body = clean(value);
  if (!body) {
    throw new DocumentError(`"${name}" no tiene texto extraíble.`, "DOCX_EMPTY");
  }

  const blocks = body.split(/\n{2,}/).filter(Boolean);
  const { text, included, truncated } = assembleBlocks(blocks, () => "", MAX_DOC_CHARS);

  return {
    name,
    text,
    totalPages: blocks.length,
    includedPages: included,
    truncated,
    warnings: [],
  };
}

export function isSupportedDocument(fileName: string, mimeType: string): boolean {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  return (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "pdf" ||
    extension === "docx"
  );
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_FILE_BYTES) {
    throw new DocumentError(
      `"${file.name}" pesa más de ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
      "TOO_LARGE"
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.toLowerCase().split(".").pop() ?? "";

  if (file.type === "application/pdf" || extension === "pdf") {
    return extractPdf(buffer, file.name);
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return extractDocx(buffer, file.name);
  }

  throw new DocumentError(
    `Tipo de archivo no soportado: ${file.type || extension || "desconocido"}.`,
    "UNSUPPORTED"
  );
}

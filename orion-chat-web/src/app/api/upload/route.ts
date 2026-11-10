import { NextResponse } from "next/server";
import { DocumentError, extractDocument } from "@/lib/documents";
import type { Attachment } from "@/lib/types";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

// unpdf y mammoth dependen de APIs de Node (Buffer, zlib): en el runtime edge
// el módulo ni siquiera bundlea.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  // Un campo `file` de texto llega como string y pasaría el chequeo de
  // presencia sin ser un archivo, así que se valida el tipo y no el valor.
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  try {
    const doc = await extractDocument(file);

    // El texto va pelado: buildOllamaMessage ya lo envuelve con los
    // delimitadores "--- Archivo adjunto: X ---" al armar el prompt.
    const attachment: Attachment = {
      name: doc.name,
      kind: "text",
      mimeType: file.type || "application/octet-stream",
      content: doc.text,
    };

    return NextResponse.json({
      attachment,
      truncated: doc.truncated,
      warnings: doc.warnings,
    });
  } catch (error) {
    // Los mensajes de DocumentError ya están redactados para el usuario final
    // (qué pasó y qué hacer), así que se devuelven tal cual.
    if (error instanceof DocumentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 }
      );
    }
    console.error("[api/upload] fallo inesperado", error);
    return NextResponse.json(
      { error: "No se pudo procesar el archivo" },
      { status: 500 }
    );
  }
}

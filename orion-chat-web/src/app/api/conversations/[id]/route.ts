import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableModels } from "@/lib/ollama";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

export const MAX_TITLE_CHARS = 120;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const { id } = await params;
  // El filtro por userId va en el WHERE, no en un chequeo aparte después de
  // traerla: así "no es tuya" y "no existe" dan la misma respuesta (404), sin
  // confirmarle a nadie que el id de otra persona es válido.
  const conversation = await prisma.conversation.findUnique({
    where: { id, userId: auth.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

// Cambios parciales sobre una conversación: renombrar el título, fijarla
// arriba del historial, o cambiarle el modelo a mitad de charla. Los tres
// campos son opcionales e independientes entre sí.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const data: { title?: string; pinned?: boolean; model?: string } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return NextResponse.json({ error: "title debe ser un string" }, { status: 400 });
    }
    const title = body.title.trim().replace(/\s+/g, " ");
    if (!title) {
      return NextResponse.json({ error: "El título no puede estar vacío" }, { status: 400 });
    }
    data.title = title.slice(0, MAX_TITLE_CHARS);
  }

  if (body.pinned !== undefined) {
    if (typeof body.pinned !== "boolean") {
      return NextResponse.json({ error: "pinned debe ser un booleano" }, { status: 400 });
    }
    data.pinned = body.pinned;
  }

  if (body.model !== undefined) {
    if (typeof body.model !== "string") {
      return NextResponse.json({ error: "model debe ser un string" }, { status: 400 });
    }
    // Se valida contra Ollama en vivo: cambiar a un modelo desinstalado
    // dejaría la conversación rota en el siguiente mensaje.
    const available = await getAvailableModels();
    if (!available.models.includes(body.model)) {
      return NextResponse.json(
        { error: `El modelo "${body.model}" no está instalado en Ollama` },
        { status: 400 }
      );
    }
    data.model = body.model;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  // Renombrar o fijar NO debería reordenar el historial, que va por
  // updatedAt: por eso se restaura el valor previo salvo que cambie el
  // modelo (eso sí es actividad real sobre la conversación).
  const current = await prisma.conversation.findUnique({ where: { id, userId: auth.id } });
  if (!current) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const conversation = await prisma.conversation.update({
    where: { id },
    data: data.model ? data : { ...data, updatedAt: current.updatedAt },
  });

  return NextResponse.json({ conversation });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const { id } = await params;
  // deleteMany en vez de delete: delete tira si el id no existe (o no es
  // tuyo, porque el WHERE lo excluye), y acá un "no había nada que borrar"
  // es un resultado válido, no un error.
  await prisma.conversation.deleteMany({ where: { id, userId: auth.id } });
  return NextResponse.json({ ok: true });
}

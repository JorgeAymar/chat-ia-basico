import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableModels } from "@/lib/ollama";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

// GET /api/conversations?q=texto
//
// Sin `q` devuelve todo el historial DEL USUARIO LOGUEADO, con las fijadas
// primero. Con `q` filtra por título Y por el contenido de los mensajes,
// para que buscar "docker" encuentre la charla aunque el título no lo
// mencione (el título sale del primer mensaje y casi nunca resume bien lo
// que se terminó hablando).
export async function GET(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: auth.id,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { messages: { some: { content: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const available = await getAvailableModels();
  const model = typeof body.model === "string" ? body.model : available.defaultModel;

  if (!model || !available.models.includes(model)) {
    return NextResponse.json(
      {
        error:
          available.error ??
          `Modelo no disponible en Ollama. Modelos detectados: ${available.models.join(", ") || "ninguno"}`,
      },
      { status: 400 }
    );
  }

  const conversation = await prisma.conversation.create({
    data: { model, userId: auth.id },
  });

  return NextResponse.json({ conversation });
}

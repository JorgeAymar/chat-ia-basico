import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableModels } from "@/lib/ollama";

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
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
    data: { model },
  });

  return NextResponse.json({ conversation });
}

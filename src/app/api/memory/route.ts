import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_MEMORY_CHARS = 500;
const MAX_MEMORIES = 100;

export async function GET() {
  const memories = await prisma.memory.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "Falta content" }, { status: 400 });
  }
  if (content.length > MAX_MEMORY_CHARS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_MEMORY_CHARS} caracteres por nota` },
      { status: 400 }
    );
  }

  const count = await prisma.memory.count();
  if (count >= MAX_MEMORIES) {
    return NextResponse.json(
      { error: `Máximo ${MAX_MEMORIES} notas de memoria` },
      { status: 400 }
    );
  }

  const memory = await prisma.memory.create({ data: { content } });
  return NextResponse.json({ memory });
}

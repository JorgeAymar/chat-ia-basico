import { NextResponse } from "next/server";
import { getSystemPrompt, setSystemPrompt } from "@/lib/settings";

export async function GET() {
  const systemPrompt = await getSystemPrompt();
  return NextResponse.json({ systemPrompt });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.systemPrompt !== "string") {
    return NextResponse.json({ error: "Falta systemPrompt (string)" }, { status: 400 });
  }
  await setSystemPrompt(body.systemPrompt);
  return NextResponse.json({ ok: true });
}

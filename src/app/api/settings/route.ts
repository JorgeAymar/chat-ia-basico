import { NextResponse } from "next/server";
import { getSystemPrompt, setSystemPrompt } from "@/lib/settings";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

export async function GET() {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const systemPrompt = await getSystemPrompt();
  return NextResponse.json({ systemPrompt });
}

export async function PUT(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;
  // El prompt de sistema es global (afecta a todos los usuarios de esta
  // instancia), así que solo el owner lo puede tocar: si cualquier miembro
  // pudiera editarlo, cambiaría el comportamiento del chat para todos.
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el owner puede editar el prompt del sistema" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.systemPrompt !== "string") {
    return NextResponse.json({ error: "Falta systemPrompt (string)" }, { status: 400 });
  }
  await setSystemPrompt(body.systemPrompt);
  return NextResponse.json({ ok: true });
}

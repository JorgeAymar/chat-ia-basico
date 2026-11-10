import { NextResponse } from "next/server";

// Sin autenticación a propósito: lo usa deploy.sh para confirmar que el
// contenedor nuevo levantó antes de cortar el tráfico hacia él (ver
// ORION_HEALTH_PATH en .env.production.example). No toca la base ni
// Ollama — solo confirma que el proceso de Next.js está respondiendo.
export async function GET() {
  return NextResponse.json({ ok: true });
}

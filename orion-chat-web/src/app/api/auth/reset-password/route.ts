import { prisma } from "@/lib/prisma";
import { consumeLoginToken, peekLoginToken } from "@/lib/auth/tokens";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const ERROR_BY_REASON: Record<string, string> = {
  not_found: "Este enlace no es válido.",
  wrong_purpose: "Este enlace no es válido.",
  expired: "Este enlace venció. Pide uno nuevo desde \"Olvidé mi contraseña\".",
  used: "Este enlace ya se usó.",
};

// Igual que el GET de accept-invite: solo para mostrar a qué cuenta
// corresponde el link, sin consumir el token.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) {
    return Response.json({ error: "Falta el token" }, { status: 400 });
  }

  const result = await peekLoginToken(token, "RESET");
  if (!result.ok) {
    return Response.json(
      { error: ERROR_BY_REASON[result.reason], code: result.reason },
      { status: 400 }
    );
  }

  return Response.json({ email: result.email });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return Response.json({ error: "Falta el token" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  const result = await consumeLoginToken(token, "RESET");
  if (!result.ok) {
    return Response.json(
      { error: ERROR_BY_REASON[result.reason], code: result.reason },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: result.userId }, data: { passwordHash } });

  // Resetear la contraseña también loguea: obligar a pasar por /login de
  // nuevo después de ya haber probado que es dueño de la cuenta (acaba de
  // usar un token que le llegó a su email) sería fricción sin beneficio.
  await createSession(result.userId);
  return Response.json({ ok: true });
}

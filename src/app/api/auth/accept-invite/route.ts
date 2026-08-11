import { prisma } from "@/lib/prisma";
import { consumeLoginToken, peekLoginToken } from "@/lib/auth/tokens";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const ERROR_BY_REASON: Record<string, string> = {
  not_found: "Este enlace de invitación no es válido.",
  wrong_purpose: "Este enlace de invitación no es válido.",
  expired: "Este enlace de invitación venció. Pedile al administrador que te invite de nuevo.",
  used: "Este enlace de invitación ya se usó.",
};

// Lo llama la página apenas carga, con el token de la URL: solo para
// mostrar a qué cuenta corresponde el link antes de pedir la contraseña. No
// consume el token (ver peekLoginToken) — el POST de abajo es el único que
// lo gasta.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) {
    return Response.json({ error: "Falta el token de invitación" }, { status: 400 });
  }

  const result = await peekLoginToken(token, "INVITE");
  if (!result.ok) {
    return Response.json(
      { error: ERROR_BY_REASON[result.reason], code: result.reason },
      { status: 400 }
    );
  }

  return Response.json({ email: result.email });
}

// El GET que mostraba el link nunca consume nada (es la página en
// src/app/accept-invite/page.tsx); acá, en el POST, es donde se gasta el
// token de un solo uso — recién cuando la persona mandó una contraseña de
// verdad, no cuando un escáner de enlaces de algún cliente de correo
// pre-cargó la URL antes de que nadie la abriera.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return Response.json({ error: "Falta el token de invitación" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  const result = await consumeLoginToken(token, "INVITE");
  if (!result.ok) {
    return Response.json(
      { error: ERROR_BY_REASON[result.reason], code: result.reason },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: result.userId },
    data: { status: "ACTIVE", acceptedAt: new Date(), passwordHash },
  });

  await createSession(result.userId);
  return Response.json({ ok: true });
}

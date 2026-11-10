import "server-only";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./session";
import type { TokenPurpose } from "@/generated/prisma/enums";

// Los links de invitación duran más que los de reset: una invitación puede
// quedar sin leer en la bandeja de entrada varios días, mientras que un
// pedido de "olvidé mi contraseña" se hace y se usa en el momento — dejarlo
// vivo mucho tiempo es una ventana de ataque más larga sin beneficio real.
const TTL_BY_PURPOSE: Record<TokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  RESET: 30 * 60 * 1000,
};

export async function createLoginToken(
  userId: string,
  purpose: TokenPurpose
): Promise<string> {
  const rawToken = generateToken();
  const expiresAt = new Date(Date.now() + TTL_BY_PURPOSE[purpose]);

  await prisma.loginToken.create({
    data: { userId, purpose, tokenHash: hashToken(rawToken), expiresAt },
  });

  return rawToken;
}

export type ConsumeTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "used" | "wrong_purpose" };

export type PeekTokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "expired" | "used" | "wrong_purpose" };

// A diferencia de consumeLoginToken, esto NO marca el token como usado: lo
// llaman las páginas de crear/restablecer contraseña apenas cargan, solo
// para mostrar a qué cuenta corresponde el link antes de que la persona
// escriba nada. Consumirlo acá rompería el flujo real (el POST de después
// lo encontraría ya usado).
export async function peekLoginToken(
  rawToken: string,
  expectedPurpose: TokenPurpose
): Promise<PeekTokenResult> {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.loginToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true } } },
  });

  if (!token) return { ok: false, reason: "not_found" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (token.purpose !== expectedPurpose) return { ok: false, reason: "wrong_purpose" };

  return { ok: true, email: token.user.email };
}

// Un token se consume una sola vez: `usedAt` se pisa en la misma consulta que
// lo valida, así dos requests casi simultáneos con el mismo link (el clásico
// "el usuario hizo doble clic", o un escáner de link-preview de algunos
// clientes de correo que sigue el link antes que la persona) no logran los
// dos crear sesión — el segundo encuentra usedAt ya seteado.
export async function consumeLoginToken(
  rawToken: string,
  expectedPurpose: TokenPurpose
): Promise<ConsumeTokenResult> {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.loginToken.findUnique({ where: { tokenHash } });

  if (!token) return { ok: false, reason: "not_found" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (token.purpose !== expectedPurpose) return { ok: false, reason: "wrong_purpose" };

  // updateMany con la condición `usedAt: null` en el WHERE es lo que hace
  // atómica la carrera descrita arriba: si dos requests llegan a la vez,
  // solo uno de los dos UPDATE afecta una fila.
  const result = await prisma.loginToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, reason: "used" };

  return { ok: true, userId: token.userId };
}

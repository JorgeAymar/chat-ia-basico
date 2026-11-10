import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// Sesión en dos capas, siguiendo el patrón que documenta Next.js para App
// Router: una fila en `Session` (la fuente de verdad, revocable borrándola)
// y una cookie firmada que solo guarda el id de esa fila, para que un
// chequeo optimista (en proxy.ts) pueda confirmar "hay sesión" sin pegarle a
// la base en cada request. La cookie NUNCA es la autoridad final: cada ruta
// la vuelve a validar contra `Session` en session-dal.ts.

const COOKIE_NAME = "orion_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Falta SESSION_SECRET en .env (generalo con: openssl rand -base64 32)"
    );
  }
  return new TextEncoder().encode(secret);
}

// El token real nunca se guarda en la base, solo su hash: si alguien lee la
// tabla Session/LoginToken no puede loguearse suplantando a nadie con esos
// datos. sha256 alcanza acá porque el secreto es la aleatoriedad del token
// (32 bytes de crypto.randomBytes), no una contraseña de baja entropía.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

type SessionCookiePayload = {
  sessionId: string;
};

async function encryptSessionId(sessionId: string): Promise<string> {
  return new SignJWT({ sessionId } satisfies SessionCookiePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_MS / 1000}s`)
    .sign(getSecretKey());
}

// Devuelve null ante cualquier problema (firma inválida, vencido, etc.) en
// vez de tirar: un chequeo optimista que explota rompe la app entera por un
// cookie corrupto o viejo.
export async function decryptSessionCookie(
  cookieValue: string | undefined
): Promise<SessionCookiePayload | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sessionId !== "string") return null;
    return { sessionId: payload.sessionId };
  } catch {
    return null;
  }
}

// Crea la fila en Session y deja la cookie httpOnly lista. Se llama desde
// las rutas de login/aceptar-invitación, nunca desde un Server Component
// (las cookies no se pueden escribir ahí, ver docs de `cookies()`).
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const rawToken = generateToken();

  const session = await prisma.session.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });

  const cookieValue = await encryptSessionId(session.id);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  const decoded = await decryptSessionCookie(raw);
  if (decoded) {
    // Se ignora el error si la fila ya no existe (sesión ya vencida o
    // borrada desde otro lado): el efecto neto que importa es "sin cookie".
    await prisma.session.delete({ where: { id: decoded.sessionId } }).catch(() => null);
  }
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, decryptSessionCookie } from "./session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "OWNER" | "MEMBER";
};

// Chequeo "seguro" (contra la base, no solo la cookie): confirma que la
// sesión sigue existiendo y no venció, y trae el usuario en la misma vuelta.
// `cache()` de React deduplica llamadas dentro del mismo request — varias
// rutas/componentes pueden llamar a esto sin multiplicar queries.
//
// Devuelve null en vez de redirigir: quien llama decide qué hacer (una ruta
// de API responde 401, una page.tsx podría redirigir). Mezclar esa decisión
// acá adentro haría el helper inútil para APIs JSON.
export const verifySession = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const decoded = await decryptSessionCookie(cookieStore.get(COOKIE_NAME)?.value);
  if (!decoded) return null;

  const session = await prisma.session.findUnique({
    where: { id: decoded.sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return { id: session.user.id, email: session.user.email, role: session.user.role };
});

// Atajo para las Route Handlers: si no hay sesión, ya devuelve la Response
// de 401 lista para `return`. Si hay, devuelve el usuario.
export async function requireUser(): Promise<AuthenticatedUser | Response> {
  const user = await verifySession();
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  return user;
}

export function isAuthenticatedUser(
  value: AuthenticatedUser | Response
): value is AuthenticatedUser {
  return !(value instanceof Response);
}

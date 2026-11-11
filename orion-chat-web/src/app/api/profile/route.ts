import { prisma } from "@/lib/prisma";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";
import { isTheme, resolveTheme } from "@/lib/theme";
import { setThemeCookie } from "@/lib/theme-server";

// Preferencias del propio usuario (a diferencia de /api/settings, que es
// configuración global de la instancia y solo la toca el owner).
export async function GET() {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const row = await prisma.user.findUnique({ where: { id: auth.id }, select: { theme: true } });
  return Response.json({ email: auth.email, role: auth.role, theme: resolveTheme(row?.theme) });
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const body = await req.json().catch(() => null);
  if (!isTheme(body?.theme)) {
    return Response.json({ error: 'theme debe ser "light" o "dark"' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: auth.id }, data: { theme: body.theme } });
  await setThemeCookie(body.theme);
  return Response.json({ ok: true, theme: body.theme });
}

import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { THEME_COOKIE, resolveTheme, themeCookieOptions, type Theme } from "@/lib/theme";

// Separado de theme.ts porque eso lo importa también el cliente
// (SettingsModal) y next/headers solo existe en el servidor.
export async function setThemeCookie(theme: Theme): Promise<void> {
  const store = await cookies();
  store.set(THEME_COOKIE, theme, themeCookieOptions());
}

// Al iniciar sesión en un dispositivo nuevo, la cookie todavía no existe:
// se siembra con lo guardado en el perfil para que el primer render ya
// salga con el tema correcto.
export async function syncThemeCookieForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { theme: true } });
  await setThemeCookie(resolveTheme(user?.theme));
}

// Tema visual elegido por el usuario desde su perfil. Se guarda en la base
// (User.theme, viaja entre dispositivos) y además en una cookie legible por
// el cliente, que es lo que lee layout.tsx para pintar `data-theme` en el
// HTML del servidor — sin eso la página arranca oscura y "parpadea" a clara.
export type Theme = "light" | "dark";

export const THEMES: readonly Theme[] = ["dark", "light"];
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "orion_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function themeCookieOptions() {
  return {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}

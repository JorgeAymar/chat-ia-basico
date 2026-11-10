import "server-only";

// Los links de los emails se arman siempre a partir de APP_URL, nunca del
// header Host de la request: un Host falsificado podría hacer que un link
// de invitación o de login apunte a un dominio que no es el nuestro.
export function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Falta APP_URL en .env");
  return url.replace(/\/+$/, "");
}

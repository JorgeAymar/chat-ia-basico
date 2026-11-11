// La app vive bajo /app del dominio (la landing ocupa la raíz). Next prefija
// solo next/link, router y sus propias rutas; fetch(), location.href y los
// links de los mails hay que prefijarlos a mano con esto.
export const BASE_PATH = "/app";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

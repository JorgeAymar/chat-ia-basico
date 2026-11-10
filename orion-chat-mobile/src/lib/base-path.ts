// En dev corre sola en su propio puerto (sin prefijo). En producción se
// monta bajo /m del MISMO dominio que el cliente web (ver next.config.ts):
// evita tener que dar de alta un subdominio y un certificado nuevos, a
// costa de tener que prefijar a mano cada fetch/URL que Next no prefija
// solo (next/link sí lo hace automático; fetch() con un string literal, el
// manifest.json y los íconos, no).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

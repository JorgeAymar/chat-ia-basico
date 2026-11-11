import path from "node:path";
import type { NextConfig } from "next";

// Esta app es SOLO el frontend mobile: no tiene su propia base de datos ni
// lógica de negocio, y comparte la MISMA base que el cliente web (una sola
// fuente de verdad para conversaciones/usuarios). Todo /api/* se reescribe
// hacia el backend real (el cliente web de /src, en el mismo repo), vía
// proxy server-side de Next — no `fetch` desde el navegador a otro dominio.
// Eso evita CORS por completo y, más importante, hace que la cookie de
// sesión (httpOnly, sin `Domain` explícito — ver src/lib/auth/session.ts)
// quede scopeada al dominio de ESTA app en vez del dominio del backend: el
// navegador nunca se entera de que hay dos servidores distintos.
const WEB_APP_ORIGIN = process.env.WEB_APP_ORIGIN ?? "http://localhost:3000/app";

// En dev esta app corre sola en su propio puerto, sin prefijo. En
// producción se monta bajo /m del MISMO dominio que el cliente web (ver
// mobile/src/lib/base-path.ts) para no tener que dar de alta un subdominio
// y un certificado TLS nuevos.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Genera `.next/standalone`: igual que el cliente web, para una imagen
  // Docker liviana que no copia node_modules completo (ver Dockerfile).
  output: "standalone",
  // Sin esto, Turbopack detecta el package-lock.json de la raíz del repo
  // (el del cliente web) y asume que ESTE proyecto vive en un monorepo con
  // ese directorio como root — con lo cual intenta resolver src/proxy.ts del
  // OTRO proyecto como si fuera parte de este build y el build explota con
  // "Module not found: @/lib/auth/session" (un import que sí existe en el
  // repo del cliente web, pero no acá). Fijar el root a esta misma carpeta
  // corta esa detección automática.
  turbopack: {
    root: path.join(__dirname),
  },
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),
  async rewrites() {
    return [
      {
        // `basePath: false` + el prefijo a mano en `source`: el destino es
        // una URL externa absoluta, y Next no sabe prefijarla con /m sola
        // (ver "Rewrites with basePath support" en sus docs) — así que acá
        // se desactiva el auto-prefijo y se construye el `source` real
        // (incluido /m) a mano con la misma constante que usa el cliente.
        source: `${BASE_PATH}/api/:path*`,
        destination: `${WEB_APP_ORIGIN}/api/:path*`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;

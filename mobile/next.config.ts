import path from "node:path";
import type { NextConfig } from "next";

// Esta app es SOLO el frontend mobile: no tiene su propia base de datos ni
// lógica de negocio. Todo /api/* se reescribe hacia el backend real (el
// cliente web de /src, en el mismo repo), vía proxy server-side de Next —
// no `fetch` desde el navegador a otro dominio. Eso evita CORS por completo
// y, más importante, hace que la cookie de sesión (httpOnly, sin `Domain`
// explícito — ver src/lib/auth/session.ts) quede scopeada al dominio de ESTA
// app en vez del dominio del backend: el navegador nunca se entera de que
// hay dos servidores distintos.
const WEB_APP_ORIGIN = process.env.WEB_APP_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
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
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${WEB_APP_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;

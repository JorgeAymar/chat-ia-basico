import { ImageResponse } from "next/og";

// Ruta fija, NO la convención especial `icon.tsx`: ver el comentario en
// icon-512/route.tsx sobre por qué (bajo basePath, el <link> que Next arma
// solo para esa convención no lleva el prefijo /m y tira 404 — probado en
// este proyecto). Mismo diseño que public/logo.svg y el cliente web.
export async function GET() {
  return new ImageResponse(
    (
      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0a0a0f" />
        <circle cx="16" cy="16" r="9" stroke="#8b5cf6" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#8b5cf6" />
      </svg>
    ),
    { width: 32, height: 32 }
  );
}

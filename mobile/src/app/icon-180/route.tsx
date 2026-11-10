import { ImageResponse } from "next/og";

// Ruta fija, NO la convención especial `apple-icon.tsx` — ver el comentario
// en icon-32/route.tsx. Este es el que importa que sea nítido: es el que
// usa iOS para "agregar a inicio".
export async function GET() {
  return new ImageResponse(
    (
      <svg width={180} height={180} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0f1b30" />
        <circle cx="16" cy="16" r="9" stroke="#f2994a" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#f2994a" />
      </svg>
    ),
    { width: 180, height: 180 }
  );
}

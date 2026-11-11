import { ImageResponse } from "next/og";

// Ruta común y no la convención icon.tsx: bajo basePath (/app), el <link>
// que Next arma solo para esa convención sale sin el prefijo y da 404. Este
// se declara a mano en layout.tsx con withBase(). Mismo diseño que Logo.tsx.
export async function GET() {
  return new ImageResponse(
    (
      <svg width={180} height={180} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0a0a0f" />
        <circle cx="16" cy="16" r="9" stroke="#8b5cf6" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#8b5cf6" />
      </svg>
    ),
    { width: 180, height: 180 }
  );
}

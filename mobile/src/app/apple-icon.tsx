import { ImageResponse } from "next/og";

// Mismo diseño que src/app/apple-icon.tsx (cliente web) — ver icon.tsx acá
// mismo. En esta app SÍ importa que sea nítido: es la PWA pensada para
// "agregar a inicio" en iOS.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width={180} height={180} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0f1b30" />
        <circle cx="16" cy="16" r="9" stroke="#f2994a" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#f2994a" />
      </svg>
    ),
    { ...size }
  );
}

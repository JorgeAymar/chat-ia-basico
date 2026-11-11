import { ImageResponse } from "next/og";

// Ícono para "agregar a inicio" en iOS — mismo diseño que icon.tsx, en el
// tamaño que Apple recomienda (180x180), con el trazo del anillo escalado
// proporcionalmente para que no se vea desproporcionadamente fino.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width={180} height={180} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0a0a0f" />
        <circle cx="16" cy="16" r="9" stroke="#8b5cf6" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#8b5cf6" />
      </svg>
    ),
    { ...size }
  );
}

import { ImageResponse } from "next/og";

// Favicon/icon de pestaña — mismo diseño que public/logo.svg y
// src/components/Logo.tsx (anillo de órbita + punto sobre navy).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0a0a0f" />
        <circle cx="16" cy="16" r="9" stroke="#8b5cf6" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#8b5cf6" />
      </svg>
    ),
    { ...size }
  );
}

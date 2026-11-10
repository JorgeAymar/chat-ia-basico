import { ImageResponse } from "next/og";

// Mismo diseño que src/app/icon.tsx (cliente web) y public/logo.svg: anillo
// de órbita naranja sobre navy, parte del design system "Orion Navy Fintech".
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0f1b30" />
        <circle cx="16" cy="16" r="9" stroke="#f2994a" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#f2994a" />
      </svg>
    ),
    { ...size }
  );
}

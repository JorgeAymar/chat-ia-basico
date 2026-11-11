import { ImageResponse } from "next/og";

// Ruta fija (no la convención especial `icon.tsx`, que cuelga un hash de
// query variable) para que manifest.ts pueda apuntarle una URL estable:
// el manifest de una PWA no puede resolver esos hashes en tiempo de build.
export async function GET() {
  return new ImageResponse(
    (
      <svg width={512} height={512} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="#0a0a0f" />
        <circle cx="16" cy="16" r="9" stroke="#8b5cf6" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="2.6" fill="#8b5cf6" />
      </svg>
    ),
    { width: 512, height: 512 }
  );
}

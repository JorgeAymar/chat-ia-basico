// Marca de la app: anillo de órbita + punto — mismo diseño que public/logo.svg
// y los íconos generados (app/icon.tsx, app/apple-icon.tsx). Componente aparte
// (no <img>) para que renderice sin un request extra y escale nítido. Los
// colores salen de los tokens del tema, así que sigue al claro/oscuro.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Logo">
      <rect width="32" height="32" rx="7" fill="var(--void)" />
      <circle cx="16" cy="16" r="9" stroke="var(--accent-bright)" strokeWidth="2.4" />
      <circle cx="23" cy="9" r="2.6" fill="var(--accent-bright)" />
    </svg>
  );
}

// Versión "tile" de los diseños de Stitch: borde degradado de marca de 1px (un
// wrapper con el gradiente y padding de 1px) y el anillo adentro. `size` en px
// del tile completo.
export function LogoTile({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-xl p-px shadow-[var(--shadow-glow)] [background:var(--brand-grad)] ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="flex h-full w-full items-center justify-center rounded-[11px] bg-[var(--panel)]">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: size * 0.6, height: size * 0.6 }}>
          <circle cx="12" cy="12" r="7" stroke="var(--accent-bright)" strokeWidth="2" />
          <circle cx="17.3" cy="6.7" r="2" fill="var(--accent-bright)" />
        </svg>
      </span>
    </span>
  );
}

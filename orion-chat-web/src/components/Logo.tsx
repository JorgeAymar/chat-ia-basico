// Marca de la app: anillo de órbita + punto, sobre fondo navy — mismo diseño
// que public/logo.svg y los íconos generados (app/icon.tsx, app/apple-icon.tsx).
// Se mantiene como componente aparte (no <img>) para que renderice sin un
// request de red extra y escale nítido a cualquier tamaño.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Logo"
    >
      <rect width="32" height="32" rx="7" fill="#0a0a0f" />
      <circle cx="16" cy="16" r="9" stroke="#8b5cf6" strokeWidth="2.4" />
      <circle cx="23" cy="9" r="2.6" fill="#8b5cf6" />
    </svg>
  );
}

import Link from "next/link";

// Reemplaza el 404 por defecto de Next (fondo blanco, en inglés, sin marca):
// en una app oscura se veía como una "pantalla blanca" rota.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--void)] px-6 text-center text-[var(--ink)]">
      <p className="font-[family-name:var(--font-display)] text-6xl font-bold text-[var(--accent-bright)]">404</p>
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Esta página no existe</h1>
      <p className="max-w-sm text-sm text-[var(--ink-dim)]">
        El enlace puede estar mal escrito o la página se movió.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] [background:var(--brand-grad)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      >
        Volver a Orion Chat
      </Link>
    </main>
  );
}

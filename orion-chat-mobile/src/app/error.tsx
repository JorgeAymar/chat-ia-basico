"use client";

// Error inesperado dentro de la app: sin esto Next muestra "Application
// error" sobre fondo blanco, sin forma de reintentar.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--void)] px-6 text-center text-[var(--ink)]">
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Algo salió mal</h1>
      <p className="max-w-sm text-sm text-[var(--ink-dim)]">
        Ocurrió un error inesperado. Tus conversaciones no se perdieron.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] [background:var(--brand-grad)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      >
        Reintentar
      </button>
    </main>
  );
}

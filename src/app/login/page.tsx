"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-info";

const GENERIC_REDIRECT_ERROR = "El enlace no es válido o venció.";

function LoginPageContent() {
  const searchParams = useSearchParams();
  // Nadie del frontend nuevo genera este `?error=`, pero se sigue leyendo
  // por si algo externo (un bookmark viejo, un link de un email anterior)
  // todavía redirige acá con ese parámetro.
  const hasRedirectError = searchParams.get("error") !== null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: true; error?: string }
        | null;

      if (!data || !res.ok || !data.ok) {
        setFormError(data?.error ?? "No pudimos procesar el pedido. Probá de nuevo.");
        return;
      }

      window.location.href = "/";
    } catch {
      setFormError("No pudimos conectar con el servidor. Probá de nuevo en unos minutos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--void)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.15)]">
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">
          Ingresá con tu email y tu contraseña.
        </p>

        <div aria-live="polite" className="mt-4 flex flex-col gap-2 empty:mt-0">
          {hasRedirectError && !formError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {GENERIC_REDIRECT_ERROR}
            </p>
          )}
          {formError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <label
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
          >
            Email
          </label>
          <input
            ref={inputRef}
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@empresa.com"
            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
          />

          <label
            htmlFor="password"
            className="mt-3 block text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
          />

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mt-4 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--ink-dim)]">
          <Link
            href="/forgot-password"
            className="text-[var(--accent-bright)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams exige un límite de Suspense para no forzar toda la ruta
  // a renderizado del lado del cliente en el build de producción.
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

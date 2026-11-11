"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-info";
import { Logo } from "@/components/Logo";

const GENERIC_REDIRECT_ERROR = "El enlace no es válido o venció.";

function LoginPageContent() {
  const searchParams = useSearchParams();
  // Nadie del frontend nuevo genera este `?error=`, pero se sigue leyendo
  // por si algo externo (un bookmark viejo, un link de un email anterior)
  // todavía redirige acá con ese parámetro.
  const hasRedirectError = searchParams.get("error") !== null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        setFormError(data?.error ?? "No pudimos procesar el pedido. Vuelve a intentarlo.");
        return;
      }

      window.location.href = "/";
    } catch {
      setFormError("No pudimos conectar con el servidor. Vuelve a intentarlo en unos minutos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--void)] px-4">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[440px] w-[640px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,var(--accent-dim),transparent_65%)]" />
      <div className="relative w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--panel)]/90 p-7 shadow-xl backdrop-blur-xl">
        <div className="w-fit rounded-xl [background:var(--brand-grad)] p-[1px] shadow-[var(--shadow-glow)]">
          <Logo className="h-10 w-10 rounded-xl" />
        </div>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--ink)]">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">
          Ingresa con tu correo y tu contraseña.
        </p>

        <div aria-live="polite" className="mt-4 flex flex-col gap-2 empty:mt-0">
          {hasRedirectError && !formError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-[color-mix(in_srgb,#ef4444_70%,var(--ink))]">
              {GENERIC_REDIRECT_ERROR}
            </p>
          )}
          {formError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-[color-mix(in_srgb,#ef4444_70%,var(--ink))]">
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
            placeholder="tu@empresa.com"
            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--void)]/70 px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-dim)]/60 focus:border-[var(--accent-bright)]/60 focus:ring-2 focus:ring-[var(--accent-bright)]/30"
          />

          <label
            htmlFor="password"
            className="mt-3 block text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
          >
            Contraseña
          </label>
          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--void)]/70 px-3.5 py-2.5 pr-10 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-dim)]/60 focus:border-[var(--accent-bright)]/60 focus:ring-2 focus:ring-[var(--accent-bright)]/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[var(--ink-dim)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1.5 1.5l13 13M6.7 6.8a2 2 0 002.6 2.6M4.3 4.3C2.6 5.4 1.3 7 1 8c.7 2.2 3.2 5 7 5 1.3 0 2.4-.3 3.4-.8M10.6 3.7A8.3 8.3 0 0115 8c-.3.9-1 2-1.9 2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mt-4 w-full rounded-xl [background:var(--brand-grad)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
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

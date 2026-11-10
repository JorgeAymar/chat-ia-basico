"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-info";

type ForgotPasswordResponse = {
  ok: true;
  message: string;
  devResetUrl?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as
        | (Partial<ForgotPasswordResponse> & { error?: string })
        | null;

      // El backend responde 200 siempre que el POST llegue bien (nunca
      // revela si el email tiene cuenta); un `!res.ok` acá es un error real
      // (400 de email inválido) y no "cuenta inexistente".
      if (!data || !res.ok || !data.ok) {
        setFormError(data?.error ?? "No pudimos procesar el pedido. Vuelve a intentarlo.");
        return;
      }

      setMessage(
        data.message ??
          "Si el email tiene una cuenta activa, te mandamos un enlace para restablecer la contraseña.",
      );
      setDevResetUrl(data.devResetUrl ?? null);
    } catch {
      setFormError("No pudimos conectar con el servidor. Vuelve a intentarlo en unos minutos.");
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
          Te mandamos un enlace para elegir una contraseña nueva.
        </p>

        <div aria-live="polite" className="mt-4 flex flex-col gap-2 empty:mt-0">
          {formError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          )}
          {message && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2.5 text-sm text-[var(--ink)]">
              <p>{message}</p>
            </div>
          )}
        </div>

        {message ? (
          devResetUrl && (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--accent)]/40 bg-[var(--accent-dim)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
                Solo en desarrollo
              </p>
              <p className="mt-1 text-xs text-[var(--ink-dim)]">
                Este atajo no existe en producción: es para no depender de leer un correo real al
                probar la app.
              </p>
              <a
                href={devResetUrl}
                className="mt-2 inline-flex rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-bright)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
              >
                Restablecer ahora (dev)
              </a>
            </div>
          )
        ) : (
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
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="mt-3 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              {loading ? "Enviando…" : "Enviarme un enlace"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-[var(--ink-dim)]">
          <Link
            href="/login"
            className="text-[var(--accent-bright)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            Volver a ingresar
          </Link>
        </p>
      </div>
    </main>
  );
}

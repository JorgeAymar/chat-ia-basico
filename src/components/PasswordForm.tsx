"use client";

import { useEffect, useRef, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;

type PasswordFormProps = {
  // Endpoint de destino: /api/auth/accept-invite o /api/auth/reset-password.
  // Comparten forma de request y de respuesta, así que un solo componente
  // alcanza para las dos pantallas.
  endpoint: string;
  token: string;
  submitLabel: string;
  loadingLabel: string;
};

// Formulario de "elegí una contraseña" compartido entre accept-invite y
// reset-password: misma validación, mismo tratamiento de error, para que las
// dos pantallas se sientan parte del mismo flujo.
export function PasswordForm({
  endpoint,
  token,
  submitLabel,
  loadingLabel,
}: PasswordFormProps): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Misma validación que hace el backend, repetida acá para no gastar un
    // viaje de red en algo que ya se puede saber en el cliente.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: true; error?: string }
        | null;

      if (!data || !res.ok || !data.ok) {
        setError(data?.error ?? "No pudimos procesar el pedido. Probá de nuevo.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("No pudimos conectar con el servidor. Probá de nuevo en unos minutos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div aria-live="polite">
        {error && (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      <label
        htmlFor="password"
        className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
      >
        Contraseña
      </label>
      <input
        ref={inputRef}
        id="password"
        type="password"
        required
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      />
      <p className="mt-1 text-xs text-[var(--ink-dim)]">
        Mínimo {MIN_PASSWORD_LENGTH} caracteres
      </p>
      {tooShort && (
        <p className="mt-1 text-xs text-red-700">
          Todavía le faltan caracteres.
        </p>
      )}

      <label
        htmlFor="confirm-password"
        className="mt-3 block text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
      >
        Repetí la contraseña
      </label>
      <input
        id="confirm-password"
        type="password"
        required
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      />
      {mismatch && (
        <p className="mt-1 text-xs text-red-700">Las contraseñas no coinciden.</p>
      )}

      <button
        type="submit"
        disabled={
          loading ||
          password.length < MIN_PASSWORD_LENGTH ||
          password !== confirmPassword
        }
        className="mt-4 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
      >
        {loading ? loadingLabel : submitLabel}
      </button>
    </form>
  );
}

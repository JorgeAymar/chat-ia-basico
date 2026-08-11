"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/app-info";
import { PasswordForm } from "@/components/PasswordForm";

function AcceptInvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // null: todavía no se resolvió. string: el email de la cuenta. false: el
  // token no sirve (usado, vencido, inválido) — ver `checkError`.
  const [email, setEmail] = useState<string | null | false>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then((res) => res.json().catch(() => null))
      .then((data: { email?: string; error?: string } | null) => {
        if (cancelled) return;
        if (data?.email) {
          setEmail(data.email);
        } else {
          setEmail(false);
          setCheckError(data?.error ?? "Este enlace no es válido.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmail(false);
          setCheckError("No pudimos conectar con el servidor. Probá de nuevo en unos minutos.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--void)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.15)]">
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
          {APP_NAME}
        </h1>

        {!token ? (
          <div aria-live="polite" className="mt-4">
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              Este enlace no es válido: falta el token.
            </p>
          </div>
        ) : email === null ? (
          <p className="mt-2 text-sm text-[var(--ink-dim)]">Comprobando el enlace…</p>
        ) : email === false ? (
          <div aria-live="polite" className="mt-4">
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {checkError}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--ink-dim)]">
              Creá tu contraseña para activar la cuenta de{" "}
              <span className="font-medium text-[var(--ink)]">{email}</span>.
            </p>
            <PasswordForm
              endpoint="/api/auth/accept-invite"
              token={token}
              submitLabel="Activar cuenta"
              loadingLabel="Activando…"
            />
          </>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  // useSearchParams exige un límite de Suspense para no forzar toda la ruta
  // a renderizado del lado del cliente en el build de producción.
  return (
    <Suspense fallback={null}>
      <AcceptInvitePageContent />
    </Suspense>
  );
}

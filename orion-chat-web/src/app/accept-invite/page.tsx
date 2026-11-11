"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/app-info";
import { Logo } from "@/components/Logo";
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
          setCheckError("No pudimos conectar con el servidor. Vuelve a intentarlo en unos minutos.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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

        {!token ? (
          <div aria-live="polite" className="mt-4">
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-[color-mix(in_srgb,#ef4444_70%,var(--ink))]">
              Este enlace no es válido: falta el token.
            </p>
          </div>
        ) : email === null ? (
          <p className="mt-2 text-sm text-[var(--ink-dim)]">Comprobando el enlace…</p>
        ) : email === false ? (
          <div aria-live="polite" className="mt-4">
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-[color-mix(in_srgb,#ef4444_70%,var(--ink))]">
              {checkError}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--ink-dim)]">
              Crea tu contraseña para activar la cuenta de{" "}
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

"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useRef, useState } from "react";
import type { Memory } from "@/lib/types";
import { isTheme, type Theme } from "@/lib/theme";

const FOCUSABLE = 'button, input, textarea, select, [tabindex]:not([tabindex="-1"])';

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  systemPrompt: string;
  systemPromptDraft: string;
  onSystemPromptDraftChange: (value: string) => void;
  onSaveSystemPrompt: () => void;
  memories: Memory[];
  newMemoryText: string;
  onNewMemoryTextChange: (value: string) => void;
  onAddMemory: () => void;
  onDeleteMemory: (id: string) => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isOwner: boolean;
  users: Array<{
    id: string;
    email: string;
    role: "OWNER" | "MEMBER";
    status: "INVITED" | "ACTIVE";
    createdAt: string;
    acceptedAt: string | null;
  }>;
  usersLoading: boolean;
  newInviteEmail: string;
  onNewInviteEmailChange: (value: string) => void;
  onInvite: () => void;
  inviting: boolean;
  inviteError: string | null;
  inviteSuccessMessage: string | null;
  resendingUserId: string | null;
  onResendInvite: (id: string, email: string) => void;
  userEmail?: string | null;
};

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Oscuro" },
  { value: "light", label: "Claro" },
];

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === "dark" ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Selector de tema del perfil: aplica al instante sobre <html data-theme>
// y lo persiste en /api/profile (base + cookie para el render del servidor).
// Si falla, vuelve al tema anterior para no mostrar uno que no quedó guardado.
function AppearancePicker() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    const current = document.documentElement.dataset.theme;
    return isTheme(current) ? current : "dark";
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Theme) {
    if (next === theme || saving) return;
    const previous = theme;
    setTheme(next);
    setError(null);
    document.documentElement.dataset.theme = next;
    setSaving(true);
    try {
      const res = await fetch(withBase("/api/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTheme(previous);
      document.documentElement.dataset.theme = previous;
      setError("No se pudo guardar el tema. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Apariencia"
        className="mt-2 inline-flex rounded-xl border border-[var(--line)] bg-[var(--void)] p-1"
      >
        {THEME_OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(opt.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none ${
                active
                  ? "bg-[var(--accent-bright)] text-[var(--on-accent)] shadow-[var(--shadow-glow)]"
                  : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
              }`}
            >
              <ThemeIcon theme={opt.value} />
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function SettingsModal({
  open,
  onClose,
  systemPrompt,
  systemPromptDraft,
  onSystemPromptDraftChange,
  onSaveSystemPrompt,
  memories,
  newMemoryText,
  onNewMemoryTextChange,
  onAddMemory,
  onDeleteMemory,
  loading,
  saving,
  error,
  isOwner,
  users,
  usersLoading,
  newInviteEmail,
  onNewInviteEmailChange,
  onInvite,
  inviting,
  inviteError,
  inviteSuccessMessage,
  resendingUserId,
  onResendInvite,
  userEmail,
}: SettingsModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Sin esto el foco se queda en el botón que abrió el modal, detrás del
  // fondo: la primera tecla Tab navegaría la página de abajo.
  useEffect(() => {
    if (!open) return;
    modalRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  if (!open) return null;

  function handleModalTabTrap(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const container = modalRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        // El clic dentro del panel no debe burbujear al fondo, que cierra.
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleModalTabTrap}
        className="msg-enter flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)]/95 p-5 shadow-[var(--shadow-glow)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between">
          <p
            id="settings-title"
            className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]"
          >
            Configuración
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-dim)] hover:bg-[var(--panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--ink-dim)]">Cargando…</p>
        ) : (
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <section className="mb-6 border-b border-[var(--line)] pb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]">
                Perfil
              </p>
              {userEmail && <p className="mt-1 truncate text-sm text-[var(--ink)]">{userEmail}</p>}
              <p className="mt-3 text-xs font-medium text-[var(--ink-dim)]">Apariencia</p>
              <AppearancePicker />
            </section>

            <section>
              <label
                htmlFor="system-prompt"
                className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
              >
                Prompt del sistema (SYSTEM_PROMPT.md)
              </label>
              <p className="mt-1 text-xs text-[var(--ink-dim)]">
                Instrucciones que el modelo recibe en cada mensaje de cada conversación.
              </p>
              <textarea
                id="system-prompt"
                value={systemPromptDraft}
                onChange={(e) => onSystemPromptDraftChange(e.target.value)}
                rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--void)] p-3 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                {systemPromptDraft !== systemPrompt && (
                  <span className="text-xs text-[var(--ink-dim)]">Sin guardar</span>
                )}
                <button
                  type="button"
                  onClick={onSaveSystemPrompt}
                  disabled={saving || systemPromptDraft === systemPrompt}
                  className="rounded-lg bg-[image:var(--brand-grad)] px-4 py-1.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </section>

            <section className="mt-6 border-t border-[var(--line)] pt-4">
              <label
                htmlFor="new-memory"
                className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
              >
                Memoria
              </label>
              <p className="mt-1 text-xs text-[var(--ink-dim)]">
                Notas que el asistente recuerda en todas las conversaciones, no solo en esta.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onAddMemory();
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  id="new-memory"
                  value={newMemoryText}
                  onChange={(e) => onNewMemoryTextChange(e.target.value)}
                  placeholder="Ej: prefiero respuestas cortas y en español"
                  className="flex-1 rounded-full border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                />
                <button
                  type="submit"
                  disabled={!newMemoryText.trim()}
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--panel-2)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                >
                  Agregar
                </button>
              </form>

              <ul className="mt-3 flex flex-col gap-1.5">
                {memories.length === 0 && (
                  <li className="text-xs text-[var(--ink-dim)]">Todavía no hay notas guardadas.</li>
                )}
                {memories.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--ink)]"
                  >
                    <span className="break-words">{m.content}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteMemory(m.id)}
                      aria-label={`Borrar nota "${m.content}"`}
                      className="shrink-0 text-[var(--ink-dim)] hover:text-red-500 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none rounded-full"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {isOwner && (
              <section className="mt-6 border-t border-[var(--line)] pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]">
                  Usuarios
                </p>
                <p className="mt-1 text-xs text-[var(--ink-dim)]">
                  Solo tú, como owner, puedes invitar gente a esta app.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onInvite();
                  }}
                  className="mt-2 flex gap-2"
                >
                  <input
                    id="new-invite-email"
                    type="email"
                    value={newInviteEmail}
                    onChange={(e) => onNewInviteEmailChange(e.target.value)}
                    placeholder="nombre@empresa.com"
                    aria-label="Email a invitar"
                    disabled={inviting}
                    className="flex-1 rounded-full border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={inviting || !newInviteEmail.trim()}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--panel-2)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                  >
                    {inviting ? "Invitando…" : "Invitar"}
                  </button>
                </form>

                {/* Uno solo de los dos a la vez: page.tsx limpia el que sobra
                    antes de cada intento nuevo, así que acá no hace falta
                    decidir prioridad. */}
                {inviteError && (
                  <p className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                    {inviteError}
                  </p>
                )}
                {inviteSuccessMessage && (
                  <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    {inviteSuccessMessage}
                  </p>
                )}

                {usersLoading ? (
                  <p className="mt-3 text-xs text-[var(--ink-dim)]">Cargando…</p>
                ) : (
                  <ul className="mt-3 flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                    {users.length === 0 && (
                      <li className="text-xs text-[var(--ink-dim)]">
                        Todavía no invitaste a nadie.
                      </li>
                    )}
                    {users.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--ink)]"
                      >
                        <span className="truncate">{u.email}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {u.role === "OWNER" && (
                            <span className="rounded-full border border-[var(--accent)]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--accent)]">
                              Owner
                            </span>
                          )}
                          {u.status === "ACTIVE" ? (
                            <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-600">
                              Activo
                            </span>
                          ) : (
                            <>
                              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--ink-dim)]">
                                Invitado
                              </span>
                              <button
                                type="button"
                                onClick={() => onResendInvite(u.id, u.email)}
                                disabled={resendingUserId === u.id}
                                aria-label={`Reenviar invitación a ${u.email}`}
                                title="Reenviar invitación"
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--accent-bright)] transition-colors hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                              >
                                {resendingUserId === u.id ? "Enviando…" : "Reenviar"}
                              </button>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

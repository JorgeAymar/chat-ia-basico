"use client";

import { useEffect, useRef } from "react";
import type { Memory } from "@/lib/types";

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
};

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
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
        className="msg-enter flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
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
                  className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
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
                  Solo vos, como owner, podés invitar gente a esta app.
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
                  <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
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
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

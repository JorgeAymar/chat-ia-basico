"use client";

import { useState } from "react";
import { Markdown, CopyButton } from "./Markdown";
import { ThinkingBlock } from "./ThinkingBlock";
import { Sources } from "./Sources";
import type { Attachment, Message } from "@/lib/types";

const ACTION_CLASS =
  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none";

// Avatar del asistente: el mismo anillo de órbita del logo, en una baldosa
// con borde degradado de marca (diseños de Stitch).
function AssistantAvatar() {
  return (
    <div className="mt-0.5 h-8 w-8 shrink-0 rounded-xl p-px shadow-[var(--shadow-glow)] [background:var(--brand-grad)]">
      <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-[var(--panel)]">
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="9" stroke="var(--accent-bright)" strokeWidth="2.6" />
          <circle cx="23" cy="9" r="2.8" fill="var(--accent-bright)" />
        </svg>
      </div>
    </div>
  );
}

function formatTime(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function Attachments({ attachments, isUser }: { attachments: Attachment[]; isUser: boolean }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((a) =>
        a.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.name}
            src={`data:${a.mimeType};base64,${a.content}`}
            alt={a.name}
            className={`h-20 w-20 rounded-xl object-cover border ${isUser ? "border-[var(--user-bubble-border)]" : "border-[var(--line)]"}`}
          />
        ) : (
          <span
            key={a.name}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] ${
              isUser
                ? "border border-[var(--user-bubble-border)] bg-[var(--user-bubble-text)]/10 text-[var(--user-bubble-text)]"
                : "border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-dim)]"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 1.5h4l2 2v7H3v-9z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            </svg>
            {a.name}
          </span>
        )
      )}
    </div>
  );
}

function IconCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Sin permiso de portapapeles: no hay nada razonable que hacer.
        }
      }}
      aria-label={copied ? "Copiado" : "Copiar respuesta"}
      title="Copiar respuesta"
      className="rounded-md p-1 transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--accent-bright)]" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="8.5" height="8.5" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 10.5V3.8A1.3 1.3 0 014.3 2.5H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1.5 py-0.5">
      <span className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" />
      <span
        className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]"
        style={{ animationDelay: "0.3s" }}
      />
    </span>
  );
}

export function ChatMessage({
  message,
  isStreaming,
  onRegenerate,
  onEdit,
  canAct,
}: {
  message: Message;
  isStreaming: boolean;
  onRegenerate: () => void;
  onEdit: (newText: string) => void;
  canAct: boolean;
}) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  function startEditing() {
    // El borrador se resincroniza al abrir y no en un efecto: el contenido del
    // mensaje puede haber cambiado (regenerar, recarga) desde el último cierre.
    setDraft(message.content);
    setEditing(true);
  }

  function save() {
    const text = draft.trim();
    if (!text) return;
    setEditing(false);
    onEdit(text);
  }

  const attachments = message.attachments ?? [];
  const sources = message.sources ?? [];
  const thinking = message.thinking ?? "";

  const actions = !editing && !(isStreaming && !isUser);

  if (isUser) {
    return (
      <div className="msg-enter group flex w-full justify-end">
        <div className="flex max-w-[82%] min-w-0 flex-col items-end">
          <div className="w-full rounded-xl rounded-tr-none border border-[var(--user-bubble-border)] px-4 py-3 text-[14.5px] leading-relaxed text-[var(--user-bubble-text)] shadow-sm [background:var(--user-bubble-bg)] [&_code]:rounded [&_code]:bg-[var(--user-bubble-text)]/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]">
            <div className="mb-1.5 flex items-center justify-between gap-4 border-b border-[var(--user-bubble-border)] pb-1 text-[11px] font-bold opacity-80">
              <span>Tú</span>
              {formatTime(message.createdAt) && (
                <span className="font-mono font-semibold">{formatTime(message.createdAt)}</span>
              )}
            </div>
            {attachments.length > 0 && <Attachments attachments={attachments} isUser />}

            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditing(false);
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      save();
                    }
                  }}
                  rows={Math.min(draft.split("\n").length + 1, 12)}
                  autoFocus
                  aria-label="Editar mensaje"
                  className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--void)] p-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    aria-label="Cancelar edición"
                    className="rounded-lg px-3 py-1 text-[12px] opacity-80 transition-colors hover:bg-[var(--user-bubble-text)]/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!draft.trim()}
                    aria-label="Guardar cambios del mensaje"
                    className="rounded-lg px-3 py-1 text-[12px] font-medium text-[var(--on-accent)] transition-opacity [background:var(--brand-grad)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <span className="whitespace-pre-wrap">{message.content}</span>
            )}
          </div>

          {actions && (
            <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={startEditing}
                disabled={!canAct}
                aria-label="Editar mensaje"
                className={ACTION_CLASS}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                Editar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="msg-enter group flex w-full items-start gap-3">
      <AssistantAvatar />

      <div className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-xl rounded-tl-none border border-[var(--assistant-border)] bg-[var(--assistant-bg)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/70 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-[family-name:var(--font-display)] text-[13px] font-bold tracking-tight text-[var(--ink)]">
              Orion
            </span>
            {message.model && (
              <span className="truncate rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--ink-dim)]">
                {message.model}
              </span>
            )}
            {formatTime(message.createdAt) && (
              <>
                <span className="h-1 w-1 rounded-full bg-[var(--line)]" aria-hidden="true" />
                <span className="font-mono text-[11px] text-[var(--ink-dim)]">{formatTime(message.createdAt)}</span>
              </>
            )}
          </div>
          {actions && message.content && (
            <div className="flex shrink-0 items-center gap-0.5 text-[var(--ink-dim)]">
              <IconCopy text={message.content} />
              <button
                type="button"
                onClick={onRegenerate}
                disabled={!canAct}
                aria-label="Regenerar respuesta"
                title="Regenerar"
                className="rounded-md p-1 transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13 8a5 5 0 11-1.5-3.6M13 2.5v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {attachments.length > 0 && <Attachments attachments={attachments} isUser={false} />}

        {thinking.trim() && (
          <ThinkingBlock text={thinking} streaming={isStreaming} durationMs={message.thinkingMs} />
        )}

        {message.content ? (
          <div className="text-[14.5px] leading-relaxed text-[var(--ink)]">
            <Markdown content={message.content} sources={sources} />
          </div>
        ) : isStreaming ? (
          <TypingDots />
        ) : null}

        {sources.length > 0 && <Sources sources={sources} />}

        {actions && message.content && (
          <div className="flex items-center gap-1.5 pt-1">
            <CopyButton text={message.content} label="Copiar respuesta" />
            <button
              type="button"
              onClick={onRegenerate}
              disabled={!canAct}
              aria-label="Regenerar respuesta"
              className={ACTION_CLASS}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13 8a5 5 0 11-1.5-3.6M13 2.5v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Regenerar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Markdown, CopyButton } from "./Markdown";
import { ThinkingBlock } from "./ThinkingBlock";
import { Sources } from "./Sources";
import type { Attachment, Message } from "@/lib/types";

const ACTION_CLASS =
  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none";

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
            className="h-16 w-16 rounded-lg object-cover"
          />
        ) : (
          <span
            key={a.name}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
              isUser ? "bg-black/10 text-[#ffffff]" : "bg-[var(--panel-2)] text-[var(--ink-dim)]"
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 1.5h4l2 2v7H3v-9z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            </svg>
            {a.name}
          </span>
        )
      )}
    </div>
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

  return (
    <div
      className={`msg-enter group flex items-end gap-3 ${
        isUser ? "flex-row-reverse self-end" : "self-start"
      }`}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel-2)] font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--accent)]">
          A
        </div>
      )}

      <div className={`flex max-w-[75%] min-w-0 flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`w-full rounded-2xl px-5 py-3.5 text-[13.5px] leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-[var(--accent)] text-[#ffffff]"
              : "rounded-tl-sm border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-sm"
          }`}
        >
          {attachments.length > 0 && <Attachments attachments={attachments} isUser={isUser} />}

          {thinking.trim() && (
            <ThinkingBlock
              text={thinking}
              streaming={isStreaming}
              durationMs={message.thinkingMs}
            />
          )}

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
                className="w-full resize-y rounded-md bg-black/15 p-2 text-[13.5px] text-[#ffffff] placeholder:text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  aria-label="Cancelar edición"
                  className="rounded-md px-2.5 py-1 text-[11px] text-white/80 transition-colors hover:bg-black/15 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!draft.trim()}
                  aria-label="Guardar cambios del mensaje"
                  className="rounded-md bg-[#ffffff] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : message.content ? (
            <Markdown content={message.content} sources={sources} />
          ) : isStreaming ? (
            <TypingDots />
          ) : null}

          {!isUser && sources.length > 0 && <Sources sources={sources} />}
        </div>

        {!editing && (
          <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {isUser ? (
              <button
                type="button"
                onClick={startEditing}
                disabled={!canAct}
                aria-label="Editar mensaje"
                className={ACTION_CLASS}
              >
                Editar
              </button>
            ) : (
              <>
                <CopyButton text={message.content} label="Copiar respuesta" />
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={!canAct}
                  aria-label="Regenerar respuesta"
                  className={ACTION_CLASS}
                >
                  Regenerar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { Attachment } from "@/lib/types";

// Altura máxima del textarea antes de que empiece a scrollear por dentro.
const MAX_TEXTAREA_HEIGHT = 200;

// Además de imágenes y texto plano, el servidor sabe extraer texto de PDF y
// DOCX (ver src/lib/documents.ts), así que acá también se ofrecen.
const ACCEPTED_FILES =
  "image/*,text/*,.md,.json,.csv,.log,.js,.ts,.tsx,.jsx,.py,.go,.rb,.java,.c,.cpp,.h,.css,.html,.yml,.yaml,.pdf,.docx";

type ComposerProps = {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  attachments: Attachment[];
  onAttach: (files: FileList) => void;
  onRemoveAttachment: (name: string) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  uploading: boolean;
};

// Diseño de Google Stitch ("Orion Chat - Desktop, Linear Theme"): caja
// flotante translúcida con el textarea arriba y una fila de acciones abajo.
// El selector de modelo ya no vive acá: pasó al header (ver page.tsx).
export function Composer({
  input,
  onInputChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  attachments,
  onAttach,
  onRemoveAttachment,
  webSearch,
  onToggleWebSearch,
  uploading,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // El alto se recalcula en cada cambio de `input` y no en el onChange porque
  // el padre también lo vacía al enviar: si no, el textarea quedaría alto y
  // vacío. Se pone en "auto" antes de medir porque scrollHeight nunca baja
  // del alto ya fijado, y sin el reset el campo solo podría crecer.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  const canSend = !isStreaming && (input.trim().length > 0 || attachments.length > 0) && !disabled;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: con teclados de IME (japonés, chino) el Enter que confirma
    // el candidato no es un envío.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // ⌘/Ctrl+Enter lo resuelve el listener global de page.tsx para que también
    // funcione con el foco fuera del campo; si acá también enviara, un mismo
    // evento dispararía dos veces handleSend y duplicaría el mensaje.
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (canSend) onSend();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="mx-auto w-full max-w-[760px]"
    >
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/90 p-2.5 shadow-lg backdrop-blur-xl transition-all duration-200 focus-within:border-[var(--accent-bright)]/60 focus-within:ring-2 focus-within:ring-[var(--accent-bright)]/30">
        {(attachments.length > 0 || uploading) && (
          <div className="flex flex-wrap gap-2 px-1 pb-2 pt-0.5">
            {attachments.map((a) => (
              <span
                key={a.name}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] py-1 pl-1 pr-2 text-xs text-[var(--ink-dim)]"
              >
                {a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${a.mimeType};base64,${a.content}`}
                    alt=""
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-dim)] text-[var(--accent-bright)]">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M3 1.5h4l2 2v7H3v-9z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                      <path d="M4.5 6h3M4.5 8h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
                <span className="max-w-[10rem] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.name)}
                  aria-label={`Quitar ${a.name}`}
                  className="rounded text-[var(--ink-dim)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                >
                  ×
                </button>
              </span>
            ))}
            {uploading && (
              <span className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] py-1 pl-2 pr-2.5 text-xs text-[var(--ink-dim)]">
                <span className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" />
                Procesando…
              </span>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={disabled ? "No hay modelos disponibles" : "Escribe un mensaje o pregunta a Orion..."}
          disabled={disabled}
          autoFocus
          className="block max-h-[200px] w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none disabled:cursor-not-allowed"
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onAttach(e.target.files);
            // Se limpia para que elegir el mismo archivo dos veces seguidas
            // vuelva a disparar onChange.
            e.target.value = "";
          }}
          className="hidden"
        />

        <div className="mt-1 flex items-center justify-between border-t border-[var(--line)]/60 pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || disabled}
              aria-label="Adjuntar archivo"
              title="Adjuntar imagen, PDF, DOCX o texto"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--void-2)] text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path
                  d="M11.5 5.5l-5 5a2 2 0 002.83 2.83l5-5a3.5 3.5 0 00-4.95-4.95l-5.3 5.3a5 5 0 007.07 7.07"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={onToggleWebSearch}
              disabled={disabled}
              aria-pressed={webSearch}
              aria-label={webSearch ? "Desactivar búsqueda web" : "Activar búsqueda web"}
              title={webSearch ? "Búsqueda web activada: se apaga tocando de nuevo" : "Buscar en la web y citar fuentes"}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none ${
                webSearch
                  ? "border-[var(--accent-bright)]/40 bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent-bright)]/20"
                  : "border-[var(--line)] bg-[var(--void-2)] text-[var(--ink-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path
                  d="M2 8h12M8 2c1.6 1.7 2.4 3.7 2.4 6S9.6 12.3 8 14C6.4 12.3 5.6 10.3 5.6 8S6.4 3.7 8 2z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Búsqueda web</span>
              {webSearch && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" aria-hidden="true" />}
            </button>
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Detener generación"
              title="Detener generación (Escape)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition-transform [background:var(--brand-grad)] hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Enviar mensaje"
              title="Enviar (Enter)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition-transform [background:var(--brand-grad)] enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 13V3M3.5 7.5L8 3l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Pista fija y de bajo peso visual: la queja más común de cualquier
          composer nuevo es "no sé si Enter manda el mensaje o hace un
          salto de línea". Se responde antes de que haga falta preguntar. */}
      <p className="mt-2 text-center text-[11px] text-[var(--ink-dim)]/80">
        <span className="font-medium text-[var(--ink-dim)]">Enter</span> envía ·{" "}
        <span className="font-medium text-[var(--ink-dim)]">Shift + Enter</span> salto de línea
      </p>
    </form>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { shortModel, isCloudModel } from "@/lib/model-utils";
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
  models: string[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  uploading: boolean;
};

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
  models,
  selectedModel,
  onSelectModel,
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
      className="mx-auto w-full max-w-2xl"
    >
      {(attachments.length > 0 || uploading) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.name}
              className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] py-1 pl-1 pr-2 text-xs text-[var(--ink-dim)]"
            >
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${a.mimeType};base64,${a.content}`}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--panel)] text-[var(--accent-bright)]">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 1.5h4l2 2v7H3v-9z"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                    <path d="M4.5 6h3M4.5 8h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                </span>
              )}
              <span className="max-w-[10rem] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(a.name)}
                aria-label={`Quitar ${a.name}`}
                className="text-[var(--ink-dim)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none rounded-full"
              >
                ×
              </button>
            </span>
          ))}
          {uploading && (
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] py-1 pl-2 pr-2.5 text-xs text-[var(--ink-dim)]">
              <span className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" />
              Procesando…
            </span>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1.5 pl-2 shadow-sm transition-colors focus-within:border-[var(--accent)]/50 focus-within:ring-1 focus-within:ring-[var(--accent)]/20">
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
        {/* Con etiqueta de texto visible, no solo ícono: "no se entiende qué
            hace cada botón" fue el motivo #1 de queja de usabilidad. El
            texto se oculta en mobile (`hidden sm:inline`) porque ahí el
            espacio horizontal es el recurso escaso, no la claridad. */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || disabled}
          aria-label="Adjuntar archivo"
          title="Adjuntar imagen, PDF, DOCX o texto"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
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
          <span className="hidden text-xs font-medium sm:inline">Adjuntar</span>
        </button>

        <button
          type="button"
          onClick={onToggleWebSearch}
          disabled={disabled}
          aria-pressed={webSearch}
          aria-label={webSearch ? "Desactivar búsqueda web" : "Activar búsqueda web"}
          title={webSearch ? "Búsqueda web activada: se apaga tocando de nuevo" : "Buscar en la web y citar fuentes"}
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
            webSearch
              ? "bg-[var(--accent-dim)] text-[var(--accent)]"
              : "text-[var(--ink-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--accent-bright)]"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M2 8h12M8 2c1.6 1.7 2.4 3.7 2.4 6S9.6 12.3 8 14C6.4 12.3 5.6 10.3 5.6 8S6.4 3.7 8 2z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden text-xs font-medium sm:inline">Buscar web</span>
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={disabled ? "No hay modelos instalados en Ollama" : "Escribí tu mensaje…"}
          disabled={disabled}
          autoFocus
          className="max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Detener generación"
            title="Detener generación (Escape)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[#ffffff] transition-colors hover:bg-[var(--accent-bright)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar mensaje"
            title="Enviar (Enter)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[#ffffff] transition-colors enabled:hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 7h11M7 2l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="relative mx-auto mt-3 flex w-fit items-center">
        <select
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value)}
          aria-label="Modelo"
          className="appearance-none rounded-full border border-[var(--line)] bg-[var(--panel)] py-1.5 pl-4 pr-8 text-xs font-medium text-[var(--ink)] outline-none transition-colors hover:border-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
        >
          {models.length === 0 && <option>Sin modelos instalados en Ollama</option>}
          {models.map((m) => (
            <option key={m} value={m} className="bg-[var(--panel)]">
              {shortModel(m)}
              {isCloudModel(m) ? " (cloud)" : ""}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--accent-bright)]"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Pista fija y de bajo peso visual: la queja más común de cualquier
          composer nuevo es "no sé si Enter manda el mensaje o hace un
          salto de línea". Se responde antes de que haga falta preguntar. */}
      <p className="mt-2 text-center text-[11px] text-[var(--ink-dim)]">
        <kbd className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-1 py-0.5 font-sans">Enter</kbd>{" "}
        envía ·{" "}
        <kbd className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-1 py-0.5 font-sans">
          Shift+Enter
        </kbd>{" "}
        salto de línea
      </p>
    </form>
  );
}

"use client";

import { useState } from "react";
import { formatThinkingDuration } from "@/lib/stream";

// Primera línea con contenido del razonamiento, para la vista previa del
// pill plegado (el "— Análisis de…" del diseño de Stitch).
function previewOf(text: string): string {
  const line = text.split("\n").find((l) => l.trim()) ?? "";
  return line.trim();
}

// Bloque plegable con el razonamiento del modelo (deepseek-r1, qwen3, gpt-oss).
//
// Arranca abierto mientras se está generando —es lo único que hay para mirar
// antes del primer token de la respuesta— y se pliega solo cuando termina,
// porque una vez que está la respuesta el razonamiento es ruido.
export function ThinkingBlock({
  text,
  streaming,
  durationMs,
}: {
  text: string;
  streaming: boolean;
  // Duración medida en el servidor. Undefined/null en los mensajes viejos de
  // la base, que se quedan con el encabezado genérico.
  durationMs?: number | null;
}) {
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);
  const open = manuallyToggled ?? streaming;

  if (!text.trim()) return null;

  const label = streaming
    ? "Pensando…"
    : durationMs === undefined || durationMs === null
      ? "Razonamiento"
      : formatThinkingDuration(durationMs);
  const preview = previewOf(text);

  return (
    <div className="max-w-full">
      <button
        type="button"
        onClick={() => setManuallyToggled(!open)}
        aria-expanded={open}
        className="group/think inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-left text-[12px] text-[var(--ink-dim)] transition-colors hover:border-[var(--accent-bright)]/40 hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-[var(--accent-bright)] ${streaming ? "animate-pulse" : ""}`}
        >
          <path
            d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2L8 1.5zM12.5 10l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
        <span className={`shrink-0 font-medium text-[var(--ink)] ${streaming ? "shimmer-text" : ""}`}>
          {label}
        </span>
        {!open && preview && (
          <span className="min-w-0 truncate text-[11.5px] text-[var(--ink-dim)]">— {preview}</span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--ink-dim)]">
          {text}
        </div>
      )}
    </div>
  );
}

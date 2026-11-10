"use client";

import { useState } from "react";
import { formatThinkingDuration } from "@/lib/stream";

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

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-2)]/60">
      <button
        type="button"
        onClick={() => setManuallyToggled(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M4 2.5L8 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className={streaming ? "shimmer-text" : ""}>{label}</span>
      </button>
      {open && (
        <div className="whitespace-pre-wrap border-t border-[var(--line)] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
          {text}
        </div>
      )}
    </div>
  );
}

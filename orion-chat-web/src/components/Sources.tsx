"use client";

import { useState } from "react";
import type { Source } from "@/lib/types";

const VISIBLE_BY_DEFAULT = 3;

// El hostname se saca con la URL parseada y no con un regex porque las URLs de
// los buscadores traen puertos, credenciales y subdominios raros. Si la URL es
// inválida se muestra tal cual: es preferible a esconder la fuente.
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function Sources({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  const collapsible = sources.length > VISIBLE_BY_DEFAULT;
  const visible = collapsible && !expanded ? sources.slice(0, VISIBLE_BY_DEFAULT) : sources;
  const hidden = sources.length - visible.length;

  return (
    <div className="pt-1">
      <p className="mb-2 font-[family-name:var(--font-label)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
        Fuentes consultadas
      </p>
      <ol className="flex flex-wrap items-center gap-2">
        {visible.map((source, index) => {
          const domain = domainOf(source.url);
          return (
            // La clave es el índice porque el número visible ES el índice+1: es
            // el marcador [n] que el modelo escribió en el texto, así que el
            // orden del array no puede cambiar sin romper las citas.
            <li key={index} className="min-w-0 max-w-full">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={source.snippet ? `${source.title}\n\n${source.snippet}` : source.title}
                className="group/src inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--accent-bright)]/40 hover:bg-[var(--panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
              >
                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-[var(--accent-dim)] px-1 font-mono text-[9.5px] font-bold text-[var(--accent-bright)]">
                  {index + 1}
                </span>
                <span className="shrink-0 font-medium">{domain}</span>
                <span className="min-w-0 max-w-[220px] truncate text-[11px] text-[var(--ink-dim)]">
                  {source.title}
                </span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-[var(--ink-dim)] transition-colors group-hover/src:text-[var(--accent-bright)]">
                  <path d="M9 3h4v4M13 3L7.5 8.5M11.5 9.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V5.5a1 1 0 011-1h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </li>
          );
        })}
        {collapsible && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? "Mostrar menos fuentes" : `Mostrar ${hidden} fuentes más`}
              className="rounded-xl px-2.5 py-1.5 text-[12px] text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              {expanded ? "Mostrar menos" : `+${hidden} más`}
            </button>
          </li>
        )}
      </ol>
    </div>
  );
}

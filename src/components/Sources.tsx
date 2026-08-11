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
    <div className="mt-3 border-t border-[var(--line)] pt-2.5">
      <p className="mb-1.5 font-[family-name:var(--font-label)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-dim)]/70">
        Fuentes ({sources.length})
      </p>
      <ol className="flex flex-col gap-1">
        {visible.map((source, index) => (
          // La clave es el índice porque el número visible ES el índice+1: es
          // el marcador [n] que el modelo escribió en el texto, así que el
          // orden del array no puede cambiar sin romper las citas.
          <li key={index}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              <span className="mt-px shrink-0 font-mono text-[10px] text-[var(--accent)]">
                [{index + 1}]
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[12px] font-medium text-[var(--ink)]">
                    {source.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--ink-dim)]">
                    {domainOf(source.url)}
                  </span>
                </span>
                {source.snippet && (
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-[var(--ink-dim)]">
                    {source.snippet}
                  </span>
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Mostrar menos fuentes" : `Mostrar ${hidden} fuentes más`}
          className="mt-1 rounded-md px-2 py-1 text-[11px] text-[var(--ink-dim)] transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
        >
          {expanded ? "Mostrar menos" : `Mostrar ${hidden} más`}
        </button>
      )}
    </div>
  );
}

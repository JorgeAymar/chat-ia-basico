"use client";

import { useRef } from "react";
import { SHORTCUTS, formatKey } from "@/lib/shortcuts";

type ShortcutsModalProps = {
  open: boolean;
  onClose: () => void;
  // Se decide en el cliente (ver page.tsx): durante el render inicial no se
  // sabe la plataforma sin romper la hidratación.
  isMac: boolean;
  onTabTrap: (e: React.KeyboardEvent, containerRef: React.RefObject<HTMLDivElement | null>) => void;
};

export function ShortcutsModal({ open, onClose, isMac, onTabTrap }: ShortcutsModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => onTabTrap(e, containerRef)}
        className="msg-enter w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start gap-3">
          <h2
            id="shortcuts-title"
            className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]"
          >
            Atajos de teclado
          </h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Cerrar"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            ×
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys.join("+") + shortcut.description}
              className="flex items-start justify-between gap-4 text-sm"
            >
              <span className="text-[var(--ink-dim)]">{shortcut.description}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-1.5 py-0.5 font-[family-name:var(--font-body)] text-[11px] font-medium text-[var(--ink)]"
                  >
                    {formatKey(key, isMac)}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-[var(--ink-dim)]">
          Los atajos con {isMac ? "⌘" : "Ctrl"} no se disparan mientras escribís, salvo{" "}
          {isMac ? "⌘" : "Ctrl"} + Enter y Escape.
        </p>
      </div>
    </div>
  );
}

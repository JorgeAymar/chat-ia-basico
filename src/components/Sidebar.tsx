"use client";

import { useEffect, useRef, useState } from "react";
import { shortModel } from "@/lib/model-utils";
import { APP_NAME, APP_VERSION } from "@/lib/app-info";
import type { Conversation } from "@/lib/types";

type SidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRequestDelete: (e: React.MouseEvent | React.KeyboardEvent, id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRename: (id: string, title: string) => void;
  onOpenSettings: (e?: React.MouseEvent) => void;
  onOpenShortcuts: (e?: React.MouseEvent) => void;
  search: string;
  onSearchChange: (value: string) => void;
  // Lo maneja el atajo ⌘/Ctrl+K desde page.tsx, que necesita enfocar este
  // campo sin que el sidebar tenga que exponer estado propio.
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  // Oculta el panel en escritorio (⌘/Ctrl+B). En móvil eso ya lo decide
  // `open`, que además pinta el fondo oscuro.
  collapsed: boolean;
  ollamaOnline: boolean | null;
  ollamaUrl: string | null;
  // Ollama corriendo fuera de esta máquina: cambia lo que la app puede
  // prometer sobre privacidad, así que se muestra explícito.
  ollamaRemote: boolean;
  // null mientras todavía no llegó GET /api/auth/me: el bloque de sesión
  // no se muestra hasta tener el email real, para no parpadear vacío.
  currentUserEmail: string | null;
  onLogout: () => void;
};

export function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNew,
  onSelect,
  onRequestDelete,
  onTogglePin,
  onRename,
  onOpenSettings,
  onOpenShortcuts,
  search,
  onSearchChange,
  searchInputRef,
  collapsed,
  ollamaOnline,
  ollamaUrl,
  ollamaRemote,
  currentUserEmail,
  onLogout,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // Escape cancela borrando el borrador, pero el blur que viene después del
  // desmontaje no debe guardar: esta bandera distingue los dos caminos.
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function startRename(conversation: Conversation) {
    cancelledRef.current = false;
    setDraftTitle(conversation.title);
    setEditingId(conversation.id);
  }

  function commitRename(id: string) {
    if (cancelledRef.current) return;
    const title = draftTitle.trim();
    setEditingId(null);
    // Un título vacío dejaría la conversación sin nada que mostrar en la
    // lista, así que se descarta el cambio en vez de guardarlo.
    if (!title) return;
    onRename(id, title);
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? conversations.filter((c) => c.title.toLowerCase().includes(query))
    : conversations;
  // El servidor ya las manda con las fijadas primero, pero la UI necesita los
  // dos grupos por separado para poder titularlos.
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);

  function renderItem(c: Conversation) {
    const active = c.id === activeId;
    const editing = c.id === editingId;

    return (
      <div
        key={c.id}
        className={`group relative rounded-lg transition-colors ${
          active ? "bg-[var(--panel-2)]" : "hover:bg-[var(--panel-2)]/60"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent-bright)]" />
        )}

        {editing ? (
          <div className="py-2.5 pl-3 pr-3">
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => commitRename(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename(c.id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelledRef.current = true;
                  setEditingId(null);
                }
              }}
              aria-label={`Renombrar "${c.title}"`}
              autoFocus
              className="w-full rounded-md border border-[var(--line)] bg-[var(--void)] px-2 py-1 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            />
            <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-dim)]">
              {shortModel(c.model)}
            </span>
          </div>
        ) : (
          <button
            onClick={() => onSelect(c.id)}
            onDoubleClick={() => startRename(c)}
            // Doble clic para renombrar no tiene ningún indicio visual propio
            // (no hay lápiz, no hay menú): el tooltip nativo es la única pista
            // de que existe, sin agregarle un ícono más a una fila ya angosta.
            title="Doble clic para renombrar"
            className={`w-full rounded-lg py-2.5 pl-3 pr-16 text-left focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
              active ? "text-[var(--ink)]" : "text-[var(--ink-dim)] group-hover:text-[var(--ink)]"
            }`}
          >
            <span className="block truncate text-sm">{c.title}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-dim)]">
              {shortModel(c.model)}
            </span>
          </button>
        )}

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(c.id, !c.pinned);
            }}
            aria-label={c.pinned ? `Desfijar "${c.title}"` : `Fijar "${c.title}"`}
            title={c.pinned ? "Desfijar" : "Fijar"}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:bg-[var(--panel)] hover:text-[var(--accent-bright)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none group-hover:opacity-100 ${
              c.pinned
                ? "text-[var(--accent-bright)] opacity-100"
                : "text-[var(--ink-dim)] opacity-0"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M7.4 1.2l3.4 3.4-1 .3a2.4 2.4 0 00-1.2.7L6.8 7.4 4.6 5.2l1.8-1.8c.34-.34.58-.75.7-1.2l.3-1z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
                fill={c.pinned ? "currentColor" : "none"}
              />
              <path
                d="M4.6 5.2L2.4 7.4l2.2 2.2 2.2-2.2M3.6 8.4L1.5 10.5"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete(e, c.id);
            }}
            aria-label={`Borrar "${c.title}"`}
            title="Borrar"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-dim)] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none group-hover:opacity-100"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M4 5.5v3M6 5.5v3M8 5.5v3M2.75 3l.5 7a1 1 0 001 .9h3.5a1 1 0 001-.9l.5-7"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${
          // md:flex y md:hidden pelean por la misma propiedad, así que se
          // elige una sola en vez de dejar las dos y depender del orden.
          collapsed ? "md:hidden" : "md:relative md:z-10 md:flex md:translate-x-0 md:bg-[var(--panel)]/80"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] font-[family-name:var(--font-display)] text-xs font-bold text-white">
            {APP_NAME.slice(0, 2).toUpperCase()}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--panel)] ${
                ollamaOnline === null
                  ? "bg-[var(--accent-bright)]"
                  : ollamaOnline
                  ? "bg-emerald-500"
                  : "bg-red-500"
              }`}
              title={
                ollamaOnline === null
                  ? "Comprobando Ollama…"
                  : ollamaOnline
                  ? "Ollama conectado"
                  : "Ollama desconectado"
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-base font-semibold leading-tight tracking-tight text-[var(--ink)]">
              {APP_NAME}
            </h1>
            <span
              className="font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-wider text-[var(--ink-dim)]"
              title={`${APP_NAME} versión ${APP_VERSION}`}
            >
              v{APP_VERSION}
            </span>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-widest ${
              ollamaOnline === false
                ? "border-red-500/30 text-red-500"
                : "border-[var(--line)] text-[var(--ink-dim)]"
            }`}
          >
            {ollamaOnline === false ? "sin conexión" : ollamaRemote ? "remoto" : "local"}
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configuración"
            title="Configuración"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M13 8.6v-1.2l-1.4-.35a4.4 4.4 0 00-.5-1.2l.75-1.25-.85-.85-1.25.75a4.4 4.4 0 00-1.2-.5L8.2 3H7l-.35 1.4c-.43.11-.83.28-1.2.5L4.2 4.15l-.85.85.75 1.25c-.22.37-.39.77-.5 1.2L2.2 7.8V9l1.4.35c.11.43.28.83.5 1.2l-.75 1.25.85.85 1.25-.75c.37.22.77.39 1.2.5L7 13.8h1.2l.35-1.4c.43-.11.83-.28 1.2-.5l1.25.75.85-.85-.75-1.25c.22-.37.39-.77.5-1.2L13 8.6z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {ollamaUrl && (
          <p
            className="-mt-3 px-5 pb-4 font-mono text-[10px] text-[var(--ink-dim)]"
            title={`Ollama en ${ollamaUrl}`}
          >
            {ollamaUrl}
          </p>
        )}

        <div className="px-4">
          <button
            onClick={onNew}
            className="group relative w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-4 py-2.5 text-left text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span className="text-base leading-none text-[var(--accent-bright)]">+</span>
              Nueva conversación
            </span>
          </button>
        </div>

        <div className="relative mt-4 px-4">
          <svg
            className="pointer-events-none absolute left-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-dim)]"
            viewBox="0 0 14 14"
            fill="none"
          >
            <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.2 9.2L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar conversaciones…"
            aria-label="Buscar conversaciones"
            className="w-full rounded-full border border-[var(--line)] bg-[var(--void)] py-1.5 pl-8 pr-8 text-xs text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none transition-colors hover:border-[var(--accent)]/40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
              className="absolute right-6 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="mt-5 flex-1 overflow-y-auto px-3 pb-4">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-xs text-[var(--ink-dim)]">
              {query
                ? `No hay conversaciones que coincidan con «${search.trim()}»`
                : "Todavía no hay conversaciones."}
            </p>
          )}

          {pinned.length > 0 && (
            <>
              <p className="px-2 pb-2 font-[family-name:var(--font-label)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-dim)]/70">
                Fijadas
              </p>
              <div className="flex flex-col gap-1">{pinned.map(renderItem)}</div>
            </>
          )}

          {rest.length > 0 && (
            <>
              <p
                className={`px-2 pb-2 font-[family-name:var(--font-label)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-dim)]/70 ${
                  pinned.length > 0 ? "mt-5" : ""
                }`}
              >
                Historial
              </p>
              <div className="flex flex-col gap-1">{rest.map(renderItem)}</div>
            </>
          )}
        </div>

        <div className="border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Ver los atajos de teclado"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="4" width="13" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.1" />
              <path
                d="M4 6.5h.01M6.2 6.5h.01M8.4 6.5h.01M10.6 6.5h.01M12.6 6.5h.01M4 9.5h8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            Atajos de teclado
          </button>
        </div>

        {currentUserEmail && (
          <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
            <span
              className="min-w-0 flex-1 truncate text-[11px] text-[var(--ink-dim)]"
              title={currentUserEmail}
            >
              {currentUserEmail}
            </span>
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

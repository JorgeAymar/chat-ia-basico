"use client";

import { useEffect, useRef, useState } from "react";
import { shortModel } from "@/lib/model-utils";
import { APP_NAME, APP_VERSION } from "@/lib/app-info";
import { LogoTile } from "@/components/Logo";
import type { Conversation } from "@/lib/types";

// Layout y estilo según el diseño de Google Stitch (design/stitch/chat-desktop.png,
// proyecto "Orion Chat — Navy Fintech (actual)", pantalla "Linear Theme").

// Agrupa el historial (no las fijadas) por antigüedad: con un historial real
// una lista plana se vuelve difícil de escanear mucho antes de que haga falta
// el buscador.
const DAY_MS = 24 * 60 * 60 * 1000;

function groupByDate(items: Conversation[]): [string, Conversation[]][] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const groups = new Map<string, Conversation[]>();
  for (const c of items) {
    const diff = startOfToday - new Date(c.updatedAt).setHours(0, 0, 0, 0);
    const label =
      diff < DAY_MS ? "Hoy" : diff < 2 * DAY_MS ? "Ayer" : diff < 7 * DAY_MS ? "Últimos 7 días" : "Más antiguas";
    const bucket = groups.get(label);
    if (bucket) bucket.push(c);
    else groups.set(label, [c]);
  }

  // Orden fijo de más reciente a más antiguo (el orden de inserción del Map
  // no sirve: si no hay nada "Hoy", "Más antiguas" podría quedar antes que
  // "Últimos 7 días").
  return (["Hoy", "Ayer", "Últimos 7 días", "Más antiguas"] as const)
    .filter((label) => groups.has(label))
    .map((label) => [label, groups.get(label)!]);
}

function initialsFrom(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase();
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]";

function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none ${className}`}
    >
      {children}
    </kbd>
  );
}

function GroupLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
      {icon}
      {children}
    </p>
  );
}

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
  // Para los hints de atajo ("⌘K"/"CtrlK"). Se calcula una sola vez en
  // page.tsx (ver su comentario sobre useSyncExternalStore).
  isMac: boolean;
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
  isMac,
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

  const mod = isMac ? "⌘" : "Ctrl";
  const query = search.trim().toLowerCase();
  const filtered = query
    ? conversations.filter((c) => c.title.toLowerCase().includes(query))
    : conversations;
  // El servidor ya las manda con las fijadas primero, pero la UI necesita los
  // dos grupos por separado para poder titularlos.
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);
  const historyGroups = groupByDate(rest);

  const statusLabel =
    ollamaOnline === null
      ? "Conectando…"
      : ollamaOnline === false
      ? "Sin conexión"
      : ollamaRemote
      ? "Servidor remoto"
      : "Servidor local";

  function renderItem(c: Conversation) {
    const active = c.id === activeId;
    const editing = c.id === editingId;

    if (editing) {
      return (
        <li key={c.id} className="px-1 py-1">
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
            className="w-full rounded-xl border border-[var(--accent-bright)]/50 bg-[var(--void)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none ring-1 ring-[var(--accent-bright)]/40"
          />
        </li>
      );
    }

    return (
      <li key={c.id} className="group relative">
        <button
          onClick={() => onSelect(c.id)}
          onDoubleClick={() => startRename(c)}
          // Doble clic para renombrar no tiene indicio visual propio: el
          // tooltip nativo es la única pista, sin sumar otro ícono a la fila.
          title="Doble clic para renombrar"
          aria-current={active ? "true" : undefined}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border border-l-[3px] px-2.5 py-2 text-left transition-colors ${focusRing} ${
            active
              ? "border-[var(--accent-bright)]/25 border-l-[var(--accent-bright)] bg-[var(--accent-dim)] text-[var(--ink)]"
              : "border-transparent text-[var(--ink-dim)] hover:bg-[var(--panel-2)]/60 hover:text-[var(--ink)]"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ChatIcon
              className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent-bright)]" : "text-[var(--ink-dim)]"}`}
            />
            <span className={`truncate text-[13px] ${active ? "font-semibold text-[var(--ink)]" : "font-medium"}`}>
              {c.title}
            </span>
          </span>
          {/* El badge del modelo se oculta al hover para dejarle lugar a las
              acciones (fijar/borrar), igual de limpio que en Stitch. */}
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9.5px] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 ${
              active
                ? "border-[var(--accent-bright)]/25 bg-[var(--accent-dim)] text-[var(--accent-bright)]"
                : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink-dim)]"
            }`}
          >
            {shortModel(c.model)}
          </span>
        </button>

        <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(c.id, !c.pinned);
            }}
            aria-label={c.pinned ? `Desfijar "${c.title}"` : `Fijar "${c.title}"`}
            title={c.pinned ? "Desfijar" : "Fijar"}
            className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--panel)] ${focusRing} ${
              c.pinned ? "text-[var(--accent-bright)]" : "text-[var(--ink-dim)] hover:text-[var(--accent-bright)]"
            }`}
          >
            <PinIcon filled={c.pinned} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete(e, c.id);
            }}
            aria-label={`Borrar "${c.title}"`}
            title="Borrar"
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-[var(--ink-dim)] transition-colors hover:bg-red-500/15 hover:text-[color-mix(in_srgb,#ef4444_70%,var(--ink))] ${focusRing}`}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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
      </li>
    );
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-[var(--overlay)] backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[280px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--panel)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${
          // md:flex y md:hidden pelean por la misma propiedad, así que se
          // elige una sola en vez de dejar las dos y depender del orden.
          collapsed ? "md:hidden" : "md:relative md:z-10 md:flex md:translate-x-0"
        }`}
      >
        {/* ── Marca + acciones principales ── */}
        <div className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between px-1.5 py-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative">
                <LogoTile size={30} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--panel)] ${
                    ollamaOnline === null
                      ? "bg-[var(--accent-bright)]"
                      : ollamaOnline
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                  title={ollamaUrl ? `${statusLabel} · ${ollamaUrl}` : statusLabel}
                />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-[family-name:var(--font-display)] text-[15px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
                  {APP_NAME}
                </span>
                <span
                  className={`truncate text-[10px] font-medium tracking-wide ${
                    ollamaOnline === false ? "text-[color-mix(in_srgb,#ef4444_70%,var(--ink))]" : "text-[var(--ink-dim)]"
                  }`}
                  title={ollamaUrl ?? undefined}
                >
                  {statusLabel} · v{APP_VERSION}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNew}
            className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition-all duration-150 [background:var(--brand-grad)] hover:brightness-110 active:scale-[0.98] ${focusRing}`}
          >
            <span className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-[13px] font-medium">Nueva conversación</span>
            </span>
            <Kbd className="border-[var(--on-accent)]/20 bg-[var(--on-accent)]/15 text-[var(--on-accent)]">{mod}⇧O</Kbd>
          </button>

          <div className="relative flex items-center">
            <svg
              className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--ink-dim)]"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar en el historial…"
              aria-label="Buscar conversaciones"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--void)]/80 py-1.5 pl-8 pr-12 text-[13px] text-[var(--ink)] outline-none transition-all placeholder:text-[var(--ink-dim)]/70 focus:border-[var(--accent-bright)]/60 focus:ring-1 focus:ring-[var(--accent-bright)]/40"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
                className={`absolute right-2 flex h-5 w-5 items-center justify-center rounded-md text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] ${focusRing}`}
              >
                ×
              </button>
            ) : (
              <Kbd className="pointer-events-none absolute right-2.5 border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink-dim)]">
                {mod}K
              </Kbd>
            )}
          </div>
        </div>

        {/* ── Historial ── */}
        <nav aria-label="Historial de conversaciones" className="flex-1 space-y-4 overflow-y-auto px-2.5 py-1">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-xs text-[var(--ink-dim)]">
              {query
                ? `No hay conversaciones que coincidan con «${search.trim()}»`
                : "Todavía no hay conversaciones."}
            </p>
          )}

          {pinned.length > 0 && (
            <div>
              <GroupLabel icon={<PinIcon filled className="h-3 w-3 text-[var(--accent-bright)]" />}>Fijadas</GroupLabel>
              <ul className="space-y-0.5">{pinned.map(renderItem)}</ul>
            </div>
          )}

          {historyGroups.map(([label, items]) => (
            <div key={label}>
              <GroupLabel>{label}</GroupLabel>
              <ul className="space-y-0.5">{items.map(renderItem)}</ul>
            </div>
          ))}
        </nav>

        {/* ── Usuario ── */}
        <div className="flex flex-col gap-1 border-t border-[var(--line)] bg-[var(--void-2)] p-2.5">
          <div
            className="flex items-center justify-between rounded-xl px-2 py-1.5"
            title={ollamaUrl ?? undefined}
          >
            <span className="flex items-center gap-2.5 text-[12px] font-semibold text-[var(--ink)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--ink-dim)]">
                <rect x="2" y="2.5" width="12" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                <rect x="2" y="9" width="12" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4.5 4.75h.01M4.5 11.25h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Estado del servidor
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                ollamaOnline === null ? "bg-[var(--accent-bright)]" : ollamaOnline ? "bg-emerald-500" : "bg-red-500"
              }`}
              aria-label={statusLabel}
            />
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[var(--panel-2)]/60 ${focusRing}`}
          >
            <span className="flex items-center gap-2.5 text-[12px] font-semibold text-[var(--ink)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--ink-dim)]">
                <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M13 8.6v-1.2l-1.4-.35a4.4 4.4 0 00-.5-1.2l.75-1.25-.85-.85-1.25.75a4.4 4.4 0 00-1.2-.5L8.2 3H7l-.35 1.4c-.43.11-.83.28-1.2.5L4.2 4.15l-.85.85.75 1.25c-.22.37-.39.77-.5 1.2L2.2 7.8V9l1.4.35c.11.43.28.83.5 1.2l-.75 1.25.85.85 1.25-.75c.37.22.77.39 1.2.5L7 13.8h1.2l.35-1.4c.43-.11.83-.28 1.2-.5l1.25.75.85-.85-.75-1.25c.22-.37.39-.77.5-1.2L13 8.6z"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
              </svg>
              Configuración
            </span>
            <span className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-dim)]">
              v{APP_VERSION}
            </span>
          </button>
          <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border-t border-[var(--line)] px-2 pt-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {currentUserEmail ? (
                <>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[var(--on-accent)] [background:var(--brand-grad)]"
                    aria-hidden="true"
                  >
                    {initialsFrom(currentUserEmail)}
                  </span>
                  <span
                    className="truncate text-[12px] font-medium leading-tight text-[var(--ink)]"
                    title={currentUserEmail}
                  >
                    {currentUserEmail}
                  </span>
                </>
              ) : (
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--panel-2)]" aria-hidden="true" />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={onOpenShortcuts}
                aria-label="Atajos de teclado"
                title="Atajos de teclado"
                className={`rounded-lg p-1.5 text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] ${focusRing}`}
              >
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1.5" y="4" width="13" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.1" />
                  <path
                    d="M4 6.5h.01M6.2 6.5h.01M8.4 6.5h.01M10.6 6.5h.01M12.6 6.5h.01M4 9.5h8"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {currentUserEmail && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className={`rounded-lg p-1.5 text-[var(--ink-dim)] transition-colors hover:bg-red-500/10 hover:text-[color-mix(in_srgb,#ef4444_70%,var(--ink))] ${focusRing}`}
                >
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M6 2.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1H6M10.5 11l3-3-3-3M13.5 8H6"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5h10a1 1 0 011 1v6a1 1 0 01-1 1H7.5L4.5 14v-2.5H3a1 1 0 01-1-1v-6a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ filled, className = "h-3 w-3" }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M7.4 1.2l3.4 3.4-1 .3a2.4 2.4 0 00-1.2.7L6.8 7.4 4.6 5.2l1.8-1.8c.34-.34.58-.75.7-1.2l.3-1z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
      <path
        d="M4.6 5.2L2.4 7.4l2.2 2.2 2.2-2.2M3.6 8.4L1.5 10.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

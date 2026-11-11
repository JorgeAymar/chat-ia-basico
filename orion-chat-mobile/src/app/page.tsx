"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { createEventDecoder, formatThinkingDuration, type Source } from "@/lib/stream";
import type { Conversation, CurrentUser, Message, Theme } from "@/lib/types";
import { apiUrl } from "@/lib/base-path";

// Diseño: pantallas mobile de Google Stitch "Orion Chat - Mobile (Linear
// Theme)" (oscuro) y "Ollama Local Chat - Mobile" (claro). Todos los colores
// salen de los tokens de globals.css, así el tema elegido en el perfil se
// aplica sin recargar.

// Mismo agrupado por fecha que src/components/Sidebar.tsx (cliente web) —
// duplicado por la misma razón que stream.ts/types.ts: este proyecto no
// puede importar del otro.
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
  return (["Hoy", "Ayer", "Últimos 7 días", "Más antiguas"] as const)
    .filter((label) => groups.has(label))
    .map((label) => [label, groups.get(label)!]);
}

function shortModel(model: string | null | undefined): string {
  return (model ?? "").replace(/-cloud$|:cloud$/, "");
}

// ---------- íconos (SVG inline, sin depender de una fuente de íconos) ----------

function Icon({ d, size = 18, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const I = {
  menu: "M4 7h16M4 12h16M4 17h16",
  chevron: "M6 9l6 6 6-6",
  send: "M12 19V5M5 12l7-7 7 7",
  stop: "M7 7h10v10H7z",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.7 3.8 5.8 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.8-3.8-9S9.5 5.7 12 3z",
  copy: "M9 9h10v10H9zM5 15V5h10",
  refresh: "M4 12a8 8 0 0113.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 01-13.7 5.7L4 16M4 20v-4h4",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  brain: "M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V4M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  eyeOff: "M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M6.6 6.7C3.9 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.3-.5 4.7-1.3M9.9 5.2A9.8 9.8 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-2.9 3.9",
};

// Marca de Orion: anillo de órbita con un punto, en el acento del tema.
function OrbitMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="9" stroke="var(--accent-bright)" strokeWidth="2.6" />
      <circle cx="23" cy="9" r="2.8" fill="var(--accent-bright)" />
    </svg>
  );
}

function LogoTile({ size = 32 }: { size?: number }) {
  return (
    <div
      className="shrink-0 rounded-xl p-px shadow-[var(--shadow-glow)]"
      style={{ width: size, height: size, background: "var(--brand-grad)" }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-[var(--void)]">
        <OrbitMark size={Math.round(size * 0.6)} />
      </div>
    </div>
  );
}

// ---------- login ----------

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // Un 500 sin cuerpo (el backend cayó, no un login inválido) no trae
      // JSON — sin el `.catch` acá, `res.json()` tira y el usuario termina
      // viendo el parse error crudo en vez de un mensaje que tenga sentido.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar sesión. Probá de nuevo.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--void)] px-3.5 py-3 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-dim)] focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-dim)]";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--void)] px-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[var(--shadow-glow)]"
      >
        <LogoTile size={44} />
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--ink)]">
          Orion Chat
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">Ingresa con tu correo y tu contraseña.</p>

        <label className="mt-6 block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className={inputClass}
        />

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
          Contraseña
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="absolute bottom-0 right-0 top-1.5 flex w-11 items-center justify-center text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            <Icon d={showPassword ? I.eyeOff : I.eye} size={17} />
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl py-3 text-[15px] font-semibold text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition active:scale-[0.99] disabled:opacity-50"
          style={{ background: "var(--brand-grad)" }}
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

// ---------- mensajes ----------

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Sin permiso de portapapeles (contexto no seguro): no hay nada útil
          // que mostrar más allá de no marcar "Copiado".
        }
      }}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-[var(--ink-dim)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
    >
      <Icon d={I.copy} size={14} />
      {copied ? "Copiado" : label}
    </button>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

// Bloque de código como en Stitch: barra con los tres puntos, lenguaje y
// "Copiar"; cuerpo en JetBrains Mono. Fondo oscuro fijo en los dos temas
// (igual que el diseño claro, que también deja el código sobre negro).
const markdownComponents: Components = {
  pre({ children }) {
    const codeEl = Array.isArray(children) ? children[0] : children;
    const className =
      codeEl && typeof codeEl === "object" && "props" in codeEl
        ? ((codeEl as { props: { className?: string } }).props.className ?? "")
        : "";
    const lang = /language-(\w+)/.exec(className)?.[1] ?? "código";
    const raw = textOf(children).replace(/\n$/, "");
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--code-bg)]">
        <div className="flex items-center justify-between border-b border-white/5 bg-[var(--code-bar)] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 font-[family-name:var(--font-code)] text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {lang}
            </span>
          </div>
          <CodeCopy text={raw} />
        </div>
        <pre className="overflow-x-auto px-3.5 py-3 text-[12.5px] leading-6 text-[var(--code-ink)]">{children}</pre>
      </div>
    );
  },
};

function CodeCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition active:scale-95"
    >
      <Icon d={I.copy} size={12} />
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function ThinkingPill({ message, live }: { message: Message; live: boolean }) {
  const [open, setOpen] = useState(false);
  const thinking = message.thinking ?? "";
  const done = message.thinkingMs != null;
  const preview = thinking.split("\n").find((l) => l.trim())?.trim() ?? "";
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px]"
      >
        <span className={`text-[var(--accent-bright)] ${!done && live ? "animate-pulse" : ""}`}>
          <Icon d={I.brain} size={15} />
        </span>
        <span className="shrink-0 font-medium text-[var(--ink)]">
          {done ? formatThinkingDuration(message.thinkingMs!) : "Pensando…"}
        </span>
        {preview && <span className="min-w-0 flex-1 truncate text-[var(--ink-dim)]">— {preview}</span>}
        <span className={`ml-auto shrink-0 text-[var(--ink-dim)] transition ${open ? "rotate-180" : ""}`}>
          <Icon d={I.chevron} size={14} />
        </span>
      </button>
      {open && (
        <p className="whitespace-pre-wrap border-t border-[var(--line)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          {thinking}
        </p>
      )}
    </div>
  );
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceChips({ sources }: { sources: Source[] }) {
  return (
    <div>
      <span className="mb-2 block text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
        Fuentes consultadas
      </span>
      <div className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[12px] text-[var(--ink)]"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[var(--accent-dim)] font-[family-name:var(--font-code)] text-[9px] font-bold text-[var(--accent-bright)]">
              {i + 1}
            </span>
            <span className="truncate font-medium">{domainOf(s.url)}</span>
            <span className="shrink-0 text-[var(--ink-dim)]">
              <Icon d={I.external} size={12} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function MessageView({
  message,
  live,
  canRegenerate,
  onRegenerate,
}: {
  message: Message;
  live: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-[var(--user-bubble-border)] px-4 py-3 text-[15px] leading-relaxed text-[var(--user-bubble-text)] shadow-sm"
          style={{ background: "var(--user-bubble-bg)" }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const empty = !message.content && !message.thinking;
  return (
    <div className="assistant-card space-y-3 rounded-2xl border border-[var(--assistant-border)] bg-[var(--assistant-bg)]">
      <div className="flex items-center gap-2.5">
        <LogoTile size={28} />
        <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--ink)]">Orion</span>
        {message.model && (
          <span className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2 py-0.5 font-[family-name:var(--font-code)] text-[11px] text-[var(--accent-bright)]">
            {shortModel(message.model)}
          </span>
        )}
      </div>

      {(message.thinking || (live && empty)) && <ThinkingPill message={message} live={live} />}

      {message.content && (
        <div className="markdown-body text-[15px] leading-relaxed text-[var(--ink)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      )}

      {message.sources && message.sources.length > 0 && <SourceChips sources={message.sources} />}

      {!live && message.content && (
        <div className="flex items-center gap-1 border-t border-[var(--line)] pt-2">
          <CopyButton text={message.content} />
          {canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-[var(--ink-dim)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
            >
              <Icon d={I.refresh} size={14} />
              Regenerar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- app ----------

function currentDomTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null | undefined>(undefined);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [themeSaving, setThemeSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTheme(currentDomTheme());
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/conversations"));
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // Silencioso: un refresco de historial fallido no debería tirar abajo
      // la pantalla de chat que ya está andando.
    }
  }, []);

  // Un error acá se trata como "no hay sesión" (null): sin el try/catch,
  // `currentUser` quedaba en `undefined` para siempre — pantalla vacía sin
  // forma de reintentar.
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/me"));
      const data = await res.json();
      const user: CurrentUser | null = data.user ?? null;
      setCurrentUser(user);
      // El perfil manda: si el usuario eligió un tema en otro dispositivo, se
      // aplica acá aunque la cookie local diga otra cosa.
      if (user?.theme === "light" || user?.theme === "dark") {
        document.documentElement.dataset.theme = user.theme;
        setTheme(user.theme);
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!currentUser) return;
    fetch(apiUrl("/api/models"))
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        setSelectedModel((prev) => prev || data.defaultModel || "");
      })
      .catch(() => {
        // `models` se queda en [] y el composer deshabilita el envío (`ready`).
      });
    refreshConversations();
  }, [currentUser, refreshConversations]);

  useEffect(() => {
    // "smooth" en cada token de un stream reinicia la animación decenas de
    // veces por segundo y en Safari iOS se ve entrecortado.
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, isStreaming]);

  // Safari iOS no achica el layout viewport cuando abre el teclado: 100dvh
  // sigue midiendo lo mismo y el composer queda tapado o flotando. El
  // visualViewport sí refleja el espacio real; se publica como --app-h y el
  // contenedor raíz usa esa altura.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--app-h", `${vv.height}px`);
      // iOS desplaza la página para mostrar el campo enfocado; se revierte
      // porque el contenedor ya se ajusta solo.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Textarea que crece con el contenido, hasta un tope.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function handleSelectConversation(id: string) {
    setDrawerOpen(false);
    setActiveId(id);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/conversations/${id}`));
      const data = await res.json();
      if (res.ok) {
        setMessages(data.conversation.messages);
        setSelectedModel(data.conversation.model);
      } else {
        setError(data.error ?? "No se pudo abrir la conversación");
      }
    } catch {
      setError("No se pudo abrir la conversación");
    }
  }

  function handleNewConversation() {
    setDrawerOpen(false);
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function handleLogout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" }).catch(() => {});
    setCurrentUser(null);
    setDrawerOpen(false);
  }

  async function handleSelectModel(model: string) {
    setModelMenuOpen(false);
    setSelectedModel(model);
    // Igual que la web: el cambio de modelo a mitad de charla se persiste.
    if (activeId) {
      await fetch(apiUrl(`/api/conversations/${activeId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      }).catch(() => {});
    }
  }

  async function handleThemeChange(next: Theme) {
    if (next === theme || themeSaving) return;
    const previous = theme;
    // Se aplica al toque (optimista) y se revierte si el perfil no lo guarda.
    document.documentElement.dataset.theme = next;
    setTheme(next);
    setThemeSaving(true);
    try {
      const res = await fetch(apiUrl("/api/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!res.ok) throw new Error();
      setCurrentUser((u) => (u ? { ...u, theme: next } : u));
    } catch {
      document.documentElement.dataset.theme = previous;
      setTheme(previous);
      setError("No se pudo guardar la apariencia en tu perfil");
    } finally {
      setThemeSaving(false);
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (activeId) return activeId;
    const res = await fetch(apiUrl("/api/conversations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la conversación");
      return null;
    }
    setActiveId(data.conversation.id);
    await refreshConversations();
    return data.conversation.id as string;
  }

  // Motor único de generación para enviar y regenerar — mismo protocolo NDJSON
  // que el cliente web (ver lib/stream.ts).
  async function runGeneration(conversationId: string, body: Record<string, unknown>, userText?: string) {
    const assistantId = `local-${Date.now()}-assistant`;
    setMessages((prev) => [
      ...prev,
      ...(userText !== undefined ? [{ id: `local-${Date.now()}`, role: "user" as const, content: userText }] : []),
      { id: assistantId, role: "assistant", content: "", model: selectedModel },
    ]);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, ...body }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error hablando con el modelo");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const decodeEvents = createEventDecoder();
      const patch = (fn: (m: Message) => Message) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of decodeEvents(decoder.decode(value, { stream: true }))) {
          if (event.type === "error") setError(event.message);
          else if (event.type === "sources") patch((m) => ({ ...m, sources: event.sources }));
          else if (event.type === "thinking") patch((m) => ({ ...m, thinking: (m.thinking ?? "") + event.text }));
          else if (event.type === "thinking-done") patch((m) => ({ ...m, thinkingMs: event.ms }));
          else if (event.type === "token") patch((m) => ({ ...m, content: m.content + event.text }));
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      // Recarga los mensajes reales para que tengan ids persistidos (sin eso
      // "Regenerar" no tendría a qué id apuntar).
      try {
        const res = await fetch(apiUrl(`/api/conversations/${conversationId}`));
        const data = await res.json();
        if (res.ok) setMessages(data.conversation.messages);
      } catch {}
      refreshConversations();
    }
  }

  async function handleSend() {
    if (!input.trim() || isStreaming) return;
    setIsStreaming(true);
    const conversationId = await ensureConversation();
    if (!conversationId) {
      setIsStreaming(false);
      return;
    }
    const userText = input;
    setInput("");
    await runGeneration(conversationId, { message: userText, attachments: [], webSearch }, userText);
  }

  async function handleRegenerate(messageId: string) {
    if (!activeId || isStreaming) return;
    setIsStreaming(true);
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) setMessages(messages.slice(0, index));
    await runGeneration(activeId, { regenerateFrom: messageId, webSearch });
  }

  if (currentUser === undefined) return <div className="min-h-dvh bg-[var(--void)]" />;
  if (currentUser === null) return <LoginScreen onSuccess={loadSession} />;

  const query = search.trim().toLowerCase();
  const visible = query ? conversations.filter((c) => c.title.toLowerCase().includes(query)) : conversations;
  const pinned = visible.filter((c) => c.pinned);
  const historyGroups = groupByDate(visible.filter((c) => !c.pinned));
  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? "Nueva conversación";
  const ready = models.length > 0;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const initials = currentUser.email.slice(0, 2).toUpperCase();

  const historyItem = (c: Conversation) => (
    <button
      key={c.id}
      onClick={() => handleSelectConversation(c.id)}
      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition ${
        c.id === activeId
          ? "border border-[var(--accent-dim)] bg-[var(--panel-2)] text-[var(--ink)]"
          : "border border-transparent text-[var(--ink-dim)] active:bg-[var(--panel-2)]"
      }`}
    >
      {c.id === activeId && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--accent-bright)]" />}
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{c.title}</span>
      <span className="shrink-0 rounded-md border border-[var(--line)] bg-[var(--panel)] px-1.5 py-0.5 font-[family-name:var(--font-code)] text-[10px] text-[var(--ink-dim)]">
        {shortModel(c.model)}
      </span>
    </button>
  );

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col bg-[var(--void)] text-[var(--ink)]"
      style={{ height: "var(--app-h, 100dvh)" }}
    >
      {/* Header compacto con blur, como en Stitch */}
      <header
        className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--void)] px-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir historial"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--ink)] active:bg-[var(--panel-2)]"
        >
          <Icon d={I.menu} size={20} />
        </button>
        <p className="min-w-0 flex-1 truncate font-[family-name:var(--font-display)] text-[15px] font-semibold">
          {activeTitle}
        </p>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setModelMenuOpen((v) => !v)}
            disabled={!ready}
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
            className="flex max-w-[160px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 disabled:opacity-50"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-bright)] shadow-[var(--shadow-glow)]" />
            <span className="truncate font-[family-name:var(--font-code)] text-[12px] text-[var(--ink)]">
              {ready ? shortModel(selectedModel) : "Sin modelos"}
            </span>
            <Icon d={I.chevron} size={14} className="shrink-0 text-[var(--ink-dim)]" />
          </button>
          {modelMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
              <ul
                role="listbox"
                className="absolute right-0 z-50 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 shadow-xl"
              >
                {models.map((m) => (
                  <li key={m}>
                    <button
                      role="option"
                      aria-selected={m === selectedModel}
                      onClick={() => handleSelectModel(m)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-[family-name:var(--font-code)] text-[12.5px] ${
                        m === selectedModel ? "bg-[var(--accent-dim)] text-[var(--accent-bright)]" : "text-[var(--ink)]"
                      }`}
                    >
                      <span className="truncate">{shortModel(m)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </header>

      {/* Conversación */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <LogoTile size={52} />
            <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
              ¿En qué estás pensando?
            </p>
            <p className="max-w-xs text-sm text-[var(--ink-dim)]">
              Escribí tu primer mensaje o activá la búsqueda web para que la respuesta venga con fuentes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((m) => (
              <MessageView
                key={m.id}
                message={m}
                live={isStreaming && m.id === lastAssistantId}
                canRegenerate={!isStreaming && m.id === lastAssistantId && !m.id.startsWith("local-")}
                onRegenerate={() => handleRegenerate(m.id)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer flotante, respetando el safe-area */}
      <div
        className="relative z-30 shrink-0 bg-[var(--void)] px-3 pt-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {error && (
          <div className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            {error}
          </div>
        )}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2.5 shadow-2xl transition focus-within:border-[var(--accent-bright)] focus-within:ring-2 focus-within:ring-[var(--accent-dim)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={ready ? "Escribe un mensaje o pregunta a Orion..." : "Conectando con el servidor…"}
            disabled={!ready}
            rows={1}
            className="block max-h-40 min-h-[2.75rem] w-full resize-none bg-transparent px-1.5 py-1.5 text-base leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] disabled:opacity-50"
          />
          <div className="mt-1 flex items-center gap-2 border-t border-[var(--line)] pt-2">
            <button
              type="button"
              onClick={() => setWebSearch((v) => !v)}
              aria-pressed={webSearch}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                webSearch
                  ? "border-[var(--accent-bright)] bg-[var(--accent-dim)] text-[var(--accent-bright)]"
                  : "border-[var(--line)] text-[var(--ink-dim)]"
              }`}
            >
              <Icon d={I.globe} size={15} />
              Búsqueda web
            </button>
            <div className="flex-1" />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Detener"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink)]"
              >
                <Icon d={I.stop} size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!ready || !input.trim()}
                aria-label="Enviar"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--on-accent)] shadow-[var(--shadow-glow)] transition active:scale-95 disabled:opacity-40"
                style={{ background: "var(--brand-grad)" }}
              >
                <Icon d={I.send} size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Drawer de historial + perfil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setDrawerOpen(false)} />
          <aside
            className="relative z-10 flex h-full w-[86%] max-w-[320px] flex-col border-r border-[var(--line)] bg-[var(--panel)]"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          >
            <div className="flex items-center gap-2.5 px-4 pb-3">
              <LogoTile size={32} />
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-display)] text-[15px] font-bold leading-tight text-[var(--ink)]">
                  Orion Chat
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--ink-dim)]">
                  <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-red-500"}`} />
                  {ready ? "Conectado" : "Sin conexión con los modelos"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 px-3 pb-3">
              <button
                type="button"
                onClick={handleNewConversation}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-[var(--on-accent)] shadow-[var(--shadow-glow)] active:scale-[0.99]"
                style={{ background: "var(--brand-grad)" }}
              >
                <Icon d={I.plus} size={17} />
                Nueva conversación
              </button>
              <div className="relative">
                <Icon d={I.search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-dim)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar en el historial..."
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--void)] py-2 pl-9 pr-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] focus:border-[var(--accent-bright)]"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-3">
              {visible.length === 0 && (
                <p className="px-2 py-3 text-xs text-[var(--ink-dim)]">
                  {query ? `Nada coincide con «${search.trim()}»` : "Todavía no hay conversaciones."}
                </p>
              )}
              {pinned.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">Fijadas</p>
                  <div className="space-y-0.5">{pinned.map(historyItem)}</div>
                </div>
              )}
              {historyGroups.map(([label, items]) => (
                <div key={label}>
                  <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">{label}</p>
                  <div className="space-y-0.5">{items.map(historyItem)}</div>
                </div>
              ))}
            </div>

            {/* Perfil */}
            <div
              className="space-y-3 border-t border-[var(--line)] px-3 pt-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-center gap-2.5 px-1">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[var(--on-accent)]"
                  style={{ background: "var(--brand-grad)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--ink)]">{currentUser.email}</p>
                  <p className="text-[11px] text-[var(--ink-dim)]">{currentUser.role === "OWNER" ? "Owner" : "Miembro"}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Cerrar sesión"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-dim)] hover:bg-red-500/10 hover:text-red-500"
                >
                  <Icon d={I.logout} size={17} />
                </button>
              </div>
              <div>
                <p className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">Apariencia</p>
                <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-[var(--void)] p-1">
                  {(
                    [
                      ["dark", "Oscuro", I.moon],
                      ["light", "Claro", I.sun],
                    ] as const
                  ).map(([value, label, icon]) => (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={theme === value}
                      onClick={() => handleThemeChange(value)}
                      disabled={themeSaving}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition ${
                        theme === value
                          ? "bg-[var(--panel-2)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--accent-bright)]"
                          : "text-[var(--ink-dim)]"
                      }`}
                    >
                      <Icon d={icon} size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

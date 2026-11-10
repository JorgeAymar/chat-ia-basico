"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { createEventDecoder, type Source } from "@/lib/stream";
import type { Conversation, CurrentUser, Message } from "@/lib/types";
import { apiUrl } from "@/lib/base-path";

// Mismo agrupado por fecha que src/components/Sidebar.tsx (cliente web) —
// ver el comentario ahí sobre por qué (historial largo, difícil de escanear
// como lista plana). Duplicado acá por la misma razón que stream.ts/types.ts:
// este proyecto no puede importar del otro.
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

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      // viendo el parse error crudo ("Unexpected end of JSON input") en vez
      // de un mensaje que tenga sentido.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar sesión. Probá de nuevo.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--void)] px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6"
      >
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--ink)]">
          Orion Chat
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">Ingresa con tu correo y tu contraseña.</p>

        <label className="mt-5 block font-[family-name:var(--font-body)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--void)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
        />

        <label className="mt-4 block font-[family-name:var(--font-body)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
          Contraseña
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--void)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
        />

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-full bg-[var(--accent-bright)] py-2.5 text-sm font-semibold text-[var(--void)] shadow-[var(--shadow-glow)] transition-opacity disabled:opacity-50"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content || "…"}
            </ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-[var(--line)]/50 pt-2">
            {message.sources.map((s: Source) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-[var(--accent-bright)] underline"
              >
                {s.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Sin try/catch acá, un 500 del backend (o la red cortada) dejaba
  // `currentUser` en `undefined` para siempre — y con eso en `undefined` el
  // componente renderiza `null` sin ningún aviso: pantalla en blanco
  // permanente, sin way de reintentar. Un error acá se trata como "no hay
  // sesión" (null), igual que el cliente web (ver su page.tsx).
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/me"));
      const data = await res.json();
      setCurrentUser(data.user ?? null);
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
        setSelectedModel(data.defaultModel ?? "");
      })
      .catch(() => {
        // Silencioso: `models` se queda en [], y el composer deshabilita el
        // envío por eso (ver `ready` más abajo).
      });
    refreshConversations();
  }, [currentUser, refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSelectConversation(id: string) {
    setDrawerOpen(false);
    setActiveId(id);
    const res = await fetch(apiUrl(`/api/conversations/${id}`));
    const data = await res.json();
    if (res.ok) {
      setMessages(data.conversation.messages);
      setSelectedModel(data.conversation.model);
    }
  }

  function handleNewConversation() {
    setDrawerOpen(false);
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function handleLogout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    setCurrentUser(null);
  }

  async function ensureConversation(): Promise<string | null> {
    if (activeId) return activeId;
    const res = await fetch(apiUrl("/api/conversations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la conversación");
      return null;
    }
    setActiveId(data.conversation.id);
    await refreshConversations();
    return data.conversation.id as string;
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
    const assistantId = `local-${Date.now()}-assistant`;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: userText, attachments: [], webSearch }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error hablando con Ollama");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const decodeEvents = createEventDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of decodeEvents(decoder.decode(value, { stream: true }))) {
          if (event.type === "error") {
            setError(event.message);
          } else if (event.type === "sources") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, sources: event.sources } : m))
            );
          } else if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m))
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsStreaming(false);
      refreshConversations();
    }
  }

  if (currentUser === undefined) return null;
  if (currentUser === null) return <LoginScreen onSuccess={loadSession} />;

  const pinned = conversations.filter((c) => c.pinned);
  const historyGroups = groupByDate(conversations.filter((c) => !c.pinned));
  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? "Nueva conversación";
  // Sin esto, con Ollama caído (`models` vacío) el botón de enviar seguía
  // habilitado y el único feedback era el error devuelto por
  // `ensureConversation` después de ya haber mostrado el mensaje del
  // usuario en pantalla — igual que el cliente web (ver su `ready`).
  const ready = models.length > 0;

  return (
    <div className="flex h-dvh flex-col bg-[var(--void)] text-[var(--ink)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir historial"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate font-[family-name:var(--font-display)] text-sm font-semibold">
          {activeTitle}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              ¿En qué estás pensando?
            </p>
            <p className="text-sm text-[var(--ink-dim)]">Escribí tu primer mensaje para arrancar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="border-t border-[var(--line)] px-3 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            aria-pressed={webSearch}
            title="Búsqueda web"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              webSearch ? "bg-[var(--accent-dim)] text-[var(--accent-bright)]" : "text-[var(--ink-dim)]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2 8h12M8 2c1.7 1.8 2.6 4 2.6 6S9.7 12.2 8 14c-1.7-1.8-2.6-4-2.6-6S6.3 3.8 8 2z" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={ready ? "Escribí un mensaje…" : "Conectando con Ollama…"}
            disabled={!ready}
            rows={1}
            className="max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!ready || !input.trim() || isStreaming}
            aria-label="Enviar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bright)] text-[var(--void)] shadow-[var(--shadow-glow)] disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3 8l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside className="relative z-10 flex h-full w-[82%] max-w-xs flex-col border-r border-[var(--line)] bg-[var(--panel)]">
            <div className="flex items-center gap-2 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--void)]">
                <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8">
                  <rect width="32" height="32" rx="7" fill="#0f1b30" />
                  <circle cx="16" cy="16" r="9" stroke="#f2994a" strokeWidth="2.4" />
                  <circle cx="23" cy="9" r="2.6" fill="#f2994a" />
                </svg>
              </div>
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold">Orion Chat</p>
            </div>

            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={handleNewConversation}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2.5 text-left text-sm font-medium"
              >
                + Nueva conversación
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {pinned.length > 0 && (
                <>
                  <p className="px-1 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]/70">
                    Fijadas
                  </p>
                  {pinned.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      className={`block w-full truncate rounded-lg px-2 py-2 text-left text-sm ${
                        c.id === activeId ? "bg-[var(--panel-2)]" : "text-[var(--ink-dim)]"
                      }`}
                    >
                      {c.title}
                    </button>
                  ))}
                </>
              )}
              {historyGroups.map(([label, items]) => (
                <div key={label} className="mt-3">
                  <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]/70">
                    {label}
                  </p>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      className={`block w-full truncate rounded-lg px-2 py-2 text-left text-sm ${
                        c.id === activeId ? "bg-[var(--panel-2)]" : "text-[var(--ink-dim)]"
                      }`}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--line)] px-4 py-3">
              <button onClick={handleLogout} className="text-xs text-[var(--ink-dim)]">
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

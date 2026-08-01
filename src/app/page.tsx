"use client";

import { useEffect, useRef, useState } from "react";
import { shortModel, isCloudModel } from "@/lib/model-utils";

type Role = "user" | "assistant";

type Attachment = {
  name: string;
  kind: "text" | "image";
  mimeType: string;
  content: string;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
};

type Conversation = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
};

type Memory = {
  id: string;
  content: string;
  createdAt: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_BYTES = 300 * 1024; // 300KB
const MAX_TEXT_CHARS_IN_PROMPT = 20_000;
const MAX_ATTACHMENTS = 5;

function readFileAsAttachment(file: File): Promise<Attachment> {
  const isImage = file.type.startsWith("image/");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}"`));
    if (isImage) {
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        resolve({ name: file.name, kind: "image", mimeType: file.type, content: base64 });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        let text = reader.result as string;
        if (text.length > MAX_TEXT_CHARS_IN_PROMPT) {
          text = text.slice(0, MAX_TEXT_CHARS_IN_PROMPT) + "\n…(truncado)";
        }
        resolve({
          name: file.name,
          kind: "text",
          mimeType: file.type || "text/plain",
          content: text,
        });
      };
      reader.readAsText(file);
    }
  });
}

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        setSelectedModel(data.defaultModel ?? "");
        setOllamaOnline(data.source === "ollama");
        setOllamaUrl(data.baseUrl ?? null);
        if (data.error) setError(data.error);
      })
      .catch(() => {
        setOllamaOnline(false);
        setError("No se pudo conectar con Ollama para detectar modelos");
      });

    refreshConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (confirmDeleteId === null && !settingsOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmDeleteId !== null) {
        closeDeleteModal();
      } else if (settingsOpen) {
        closeSettingsModal();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDeleteId, settingsOpen]);

  function handleModalTabTrap(e: React.KeyboardEvent, containerRef: React.RefObject<HTMLDivElement | null>) {
    if (e.key !== "Tab") return;
    const container = containerRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function closeDeleteModal() {
    setConfirmDeleteId(null);
    deleteTriggerRef.current?.focus();
  }

  function closeSettingsModal() {
    setSettingsOpen(false);
    settingsTriggerRef.current?.focus();
  }

  async function refreshConversations() {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }

  function handleNewConversation() {
    // No crea nada todavía: la conversación real se crea recién en
    // handleSend, al enviar el primer mensaje. Así el modelo queda libre
    // para cambiarse y no quedan filas vacías en Postgres.
    setError(null);
    setMessages([]);
    setActiveId(null);
    setSidebarOpen(false);
  }

  async function handleSelectConversation(id: string) {
    setError(null);
    setActiveId(id);
    setSidebarOpen(false);
    setPendingAttachments([]);
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (res.ok) {
      setMessages(data.conversation.messages);
      setSelectedModel(data.conversation.model);
    }
  }

  function handleRequestDelete(e: React.MouseEvent | React.KeyboardEvent, id: string) {
    e.stopPropagation();
    deleteTriggerRef.current = e.currentTarget as HTMLElement;
    setConfirmDeleteId(id);
  }

  async function handleConfirmDelete() {
    const id = confirmDeleteId;
    if (!id) return;
    closeDeleteModal();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
    await refreshConversations();
  }

  async function handleOpenSettings(e?: React.MouseEvent) {
    settingsTriggerRef.current = (e?.currentTarget as HTMLElement) ?? (document.activeElement as HTMLElement | null);
    setSettingsOpen(true);
    setSettingsError(null);
    setSettingsLoading(true);
    try {
      const [settingsRes, memoriesRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/memory"),
      ]);
      const settingsData = await settingsRes.json();
      const memoriesData = await memoriesRes.json();
      setSystemPrompt(settingsData.systemPrompt ?? "");
      setSystemPromptDraft(settingsData.systemPrompt ?? "");
      setMemories(memoriesData.memories ?? []);
    } catch {
      setSettingsError("No se pudo cargar la configuración");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSaveSystemPrompt() {
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: systemPromptDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      setSystemPrompt(systemPromptDraft);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleAddMemory() {
    const content = newMemoryText.trim();
    if (!content) return;
    setSettingsError(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo agregar la nota");
      setMemories((prev) => [data.memory, ...prev]);
      setNewMemoryText("");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "No se pudo agregar la nota");
    }
  }

  async function handleDeleteMemory(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const room = MAX_ATTACHMENTS - pendingAttachments.length;
    const selected = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > selected.length) {
      setError(`Solo se admiten hasta ${MAX_ATTACHMENTS} archivos por mensaje`);
    }

    const read: Attachment[] = [];
    for (const file of selected) {
      const isImage = file.type.startsWith("image/");
      const limit = isImage ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES;
      if (file.size > limit) {
        setError(`"${file.name}" supera el límite de ${Math.round(limit / 1024 / 1024) || 1}MB`);
        continue;
      }
      try {
        read.push(await readFileAsAttachment(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo leer "${file.name}"`);
      }
    }
    setPendingAttachments((prev) => [...prev, ...read]);
  }

  function handleRemoveAttachment(name: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  async function handleSend() {
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;

    let conversationId = activeId;
    if (!conversationId) {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la conversación");
        return;
      }
      conversationId = data.conversation.id;
      setActiveId(conversationId);
      await refreshConversations();
    }

    const userText = input;
    const attachments = pendingAttachments;
    setInput("");
    setPendingAttachments([]);
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: userText, attachments },
    ]);

    setIsStreaming(true);
    const assistantId = `local-${Date.now()}-assistant`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: userText, attachments }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error hablando con Ollama");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsStreaming(false);
      refreshConversations();
    }
  }

  const ready = models.length > 0;
  const hasMessages = messages.length > 0;

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
      className="mx-auto w-full max-w-2xl"
    >
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((a) => (
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
                onClick={() => handleRemoveAttachment(a.name)}
                aria-label={`Quitar ${a.name}`}
                className="text-[var(--ink-dim)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none rounded-full"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1.5 pl-2 shadow-sm transition-colors focus-within:border-[var(--accent)]/50 focus-within:ring-1 focus-within:ring-[var(--accent)]/20">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,text/*,.md,.json,.csv,.log,.js,.ts,.tsx,.jsx,.py,.go,.rb,.java,.c,.cpp,.h,.css,.html,.yml,.yaml"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || !ready || pendingAttachments.length >= MAX_ATTACHMENTS}
          aria-label="Adjuntar archivo"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M11.5 5.5l-5 5a2 2 0 002.83 2.83l5-5a3.5 3.5 0 00-4.95-4.95l-5.3 5.3a5 5 0 007.07 7.07"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ready ? "Escribe tu mensaje…" : "Configura OLLAMA_MODELS en .env"}
          disabled={isStreaming || !ready}
          autoFocus
          className="flex-1 rounded-full bg-transparent py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
        />
        <button
          type="submit"
          disabled={isStreaming || (!input.trim() && pendingAttachments.length === 0) || !ready}
          aria-label="Enviar mensaje"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[#ffffff] transition-colors enabled:hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
        >
          {isStreaming ? (
            <span className="think-dot h-2 w-2 rounded-full bg-[#ffffff]" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 7h11M7 2l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="relative mx-auto mt-3 flex w-fit items-center">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={!!activeId}
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
    </form>
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--void)] font-[family-name:var(--font-body)] text-[var(--ink)]">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-xl transition-transform duration-300 ease-out md:relative md:z-10 md:flex md:translate-x-0 md:bg-[var(--panel)]/80 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
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
          <h1 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-[var(--ink)]">
            Ámbar
          </h1>
          <span
            className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              ollamaOnline === false
                ? "border-red-500/30 text-red-500"
                : "border-[var(--line)] text-[var(--ink-dim)]"
            }`}
          >
            {ollamaOnline === false ? "sin conexión" : "local"}
          </span>
          <button
            type="button"
            onClick={handleOpenSettings}
            aria-label="Configuración"
            title="Configuración"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ink-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 10a2 2 0 100-4 2 2 0 000 4z"
                stroke="currentColor"
                strokeWidth="1.3"
              />
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
          <p className="-mt-3 px-5 pb-4 font-mono text-[10px] text-[var(--ink-dim)]" title={`Ollama en ${ollamaUrl}`}>
            {ollamaUrl}
          </p>
        )}

        <div className="px-4">
          <button
            onClick={handleNewConversation}
            className="group relative w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-4 py-2.5 text-left text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span className="text-base leading-none text-[var(--accent-bright)]">+</span>
              Nueva conversación
            </span>
          </button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-dim)]/70">
            Historial
          </p>
          <div className="flex flex-col gap-1">
            {conversations.length === 0 && (
              <p className="px-2 py-3 text-xs text-[var(--ink-dim)]">
                Todavía no hay conversaciones.
              </p>
            )}
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectConversation(c.id)}
                  className={`group relative rounded-lg py-2.5 pl-3 pr-9 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
                    active
                      ? "bg-[var(--panel-2)] text-[var(--ink)]"
                      : "text-[var(--ink-dim)] hover:bg-[var(--panel-2)]/60 hover:text-[var(--ink)]"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent-bright)]" />
                  )}
                  <span className="block truncate text-sm">{c.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-dim)]">
                    {shortModel(c.model)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleRequestDelete(e, c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRequestDelete(e, c.id);
                      }
                    }}
                    aria-label={`Borrar "${c.title}"`}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--ink-dim)] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none group-hover:opacity-100"
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
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-4 md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir historial de conversaciones"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:border-[var(--accent)]/40 md:hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M2 8h12M2 12h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div>
            <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]">
              Conversación privada
            </p>
            <p className="text-xs text-[var(--ink-dim)]">
              {selectedModel && isCloudModel(selectedModel)
                ? "Este modelo corre en la nube de Ollama: tus mensajes sí salen de tu máquina."
                : "Servida desde tu Ollama en localhost — nada sale de tu máquina."}
            </p>
          </div>
        </header>

        {!hasMessages && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 pb-32">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)]">
                ¿En qué piensas?
              </p>
              <p className="max-w-sm text-sm text-[var(--ink-dim)]">
                Empieza una conversación con{" "}
                <span className="text-[var(--accent-bright)]">
                  {selectedModel ? shortModel(selectedModel) : "tu modelo"}
                </span>
                .{" "}
                {selectedModel && isCloudModel(selectedModel)
                  ? "Es un modelo cloud de Ollama: tus mensajes viajan a sus servidores."
                  : "Corre en tu Ollama local, nada sale de tu máquina."}
              </p>
            </div>
            {composer}
          </div>
        )}

        {hasMessages && (
        <>
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`msg-enter flex items-end gap-3 ${
                  m.role === "user" ? "flex-row-reverse self-end" : "self-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel-2)] font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--accent)]">
                    A
                  </div>
                )}
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-lg px-4 py-3 text-[13.5px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-[var(--accent)] text-[#ffffff]"
                      : "rounded-bl-sm border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
                  }`}
                >
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.attachments.map((a) =>
                        a.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={a.name}
                            src={`data:${a.mimeType};base64,${a.content}`}
                            alt={a.name}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <span
                            key={a.name}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                              m.role === "user"
                                ? "bg-black/10 text-[#ffffff]"
                                : "bg-[var(--panel-2)] text-[var(--ink-dim)]"
                            }`}
                          >
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M3 1.5h4l2 2v7H3v-9z"
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {a.name}
                          </span>
                        )
                      )}
                    </div>
                  )}
                  {m.content ? (
                    m.content
                  ) : isStreaming && m.role === "assistant" ? (
                    <span className="flex items-center gap-1.5 py-0.5">
                      <span className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" />
                      <span
                        className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </span>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div className="mx-8 mb-3">
            <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700">
              <span className="mt-0.5 text-red-500">⚠</span>
              {error}
            </div>
          </div>
        )}

        <div className="px-8 pb-8 pt-2">{composer}</div>
        </>
        )}

        {!hasMessages && error && (
          <div className="absolute bottom-28 left-0 right-0 px-8">
            <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700">
              <span className="mt-0.5 text-red-500">⚠</span>
              {error}
            </div>
          </div>
        )}
      </main>

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeDeleteModal}
        >
          <div
            ref={deleteModalRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalTabTrap(e, deleteModalRef)}
            className="msg-enter w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <p
              id="confirm-delete-title"
              className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]"
            >
              ¿Borrar esta conversación?
            </p>
            <p className="mt-1.5 truncate text-sm text-[var(--ink-dim)]">
              {conversations.find((c) => c.id === confirmDeleteId)?.title}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-dim)]">No se puede deshacer.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                autoFocus
                className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeSettingsModal}
        >
          <div
            ref={settingsModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalTabTrap(e, settingsModalRef)}
            className="msg-enter flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between">
              <p
                id="settings-title"
                className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]"
              >
                Configuración
              </p>
              <button
                type="button"
                onClick={closeSettingsModal}
                aria-label="Cerrar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-dim)] hover:bg-[var(--panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
              >
                ×
              </button>
            </div>

            {settingsLoading ? (
              <p className="py-8 text-center text-sm text-[var(--ink-dim)]">Cargando…</p>
            ) : (
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                <section>
                  <label
                    htmlFor="system-prompt"
                    className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
                  >
                    Prompt del sistema (SYSTEM_PROMPT.md)
                  </label>
                  <p className="mt-1 text-xs text-[var(--ink-dim)]">
                    Instrucciones que el modelo recibe en cada mensaje de cada conversación.
                  </p>
                  <textarea
                    id="system-prompt"
                    value={systemPromptDraft}
                    onChange={(e) => setSystemPromptDraft(e.target.value)}
                    rows={6}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--void)] p-3 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {systemPromptDraft !== systemPrompt && (
                      <span className="text-xs text-[var(--ink-dim)]">Sin guardar</span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveSystemPrompt}
                      disabled={settingsSaving || systemPromptDraft === systemPrompt}
                      className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-bright)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                    >
                      {settingsSaving ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </section>

                <section className="mt-6 border-t border-[var(--line)] pt-4">
                  <label
                    htmlFor="new-memory"
                    className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-dim)]"
                  >
                    Memoria
                  </label>
                  <p className="mt-1 text-xs text-[var(--ink-dim)]">
                    Notas que el asistente recuerda en todas las conversaciones, no solo en esta.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddMemory();
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      id="new-memory"
                      value={newMemoryText}
                      onChange={(e) => setNewMemoryText(e.target.value)}
                      placeholder="Ej: prefiero respuestas cortas y en español"
                      className="flex-1 rounded-full border border-[var(--line)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                    />
                    <button
                      type="submit"
                      disabled={!newMemoryText.trim()}
                      className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--panel-2)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                    >
                      Agregar
                    </button>
                  </form>

                  <ul className="mt-3 flex flex-col gap-1.5">
                    {memories.length === 0 && (
                      <li className="text-xs text-[var(--ink-dim)]">Todavía no hay notas guardadas.</li>
                    )}
                    {memories.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--ink)]"
                      >
                        <span className="break-words">{m.content}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemory(m.id)}
                          aria-label={`Borrar nota "${m.content}"`}
                          className="shrink-0 text-[var(--ink-dim)] hover:text-red-500 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none rounded-full"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                {settingsError && (
                  <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                    {settingsError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

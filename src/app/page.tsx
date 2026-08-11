"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isCloudModel } from "@/lib/model-utils";
import { createEventDecoder, type Source } from "@/lib/stream";
import type { AppUser, Attachment, Conversation, CurrentUser, Memory, Message } from "@/lib/types";
import { ChatMessage } from "@/components/ChatMessage";
import { Composer } from "@/components/Composer";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { ShortcutsModal } from "@/components/ShortcutsModal";
import { hasShortcutModifier, isTypingTarget } from "@/lib/shortcuts";
import { exportConversation, EXPORT_FORMAT_LABELS, type ExportFormat } from "@/lib/export";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 300 * 1024;
const MAX_TEXT_CHARS_IN_PROMPT = 20_000;
const MAX_ATTACHMENTS = 5;

// PDF y DOCX no se pueden leer en el navegador: van al servidor, que tiene
// unpdf y mammoth. El resto (texto plano, imágenes) se lee acá y evita un
// viaje de ida y vuelta.
const SERVER_PARSED = /\.(pdf|docx)$/i;

const SUGGESTIONS = [
  "Explícame qué hace este código y dónde puede fallar",
  "¿Qué salió esta semana en el mundo de la IA?",
  "Ayúdame a escribir un correo pidiendo una reunión",
  "Compara Postgres y SQLite para un proyecto pequeño",
];

// Lo que el listener global de atajos necesita saber en el momento en que se
// aprieta la tecla. Vive en un ref (ver más abajo) y no en el closure del
// efecto.
type ShortcutState = {
  isStreaming: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  confirmDeleteOpen: boolean;
  send: () => void;
  stop: () => void;
  newConversation: () => void;
  focusSearch: () => void;
  toggleSidebar: () => void;
  toggleShortcuts: () => void;
  closeShortcuts: () => void;
  closeDelete: () => void;
};

const subscribeToNothing = () => () => {};
const getIsMac = () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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
  const [status, setStatus] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState<string | null>(null);
  const [ollamaRemote, setOllamaRemote] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Sesión actual. No hace falta redirigir a /login si viene null: el
  // proxy ya garantiza que nadie sin sesión llega a renderizar esta página.
  // Se usa solo para mostrar quién es y, si es owner, habilitar "Usuarios".
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  // Id del usuario cuya invitación se está reenviando ahora mismo (null si
  // ninguna): a diferencia de `inviting`, que es para el form de invitar
  // gente nueva, esto es por fila de la lista.
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const shortcutsTriggerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shortcutStateRef = useRef<ShortcutState | null>(null);
  // Vive en un ref y no en estado porque cortar el stream no tiene que
  // provocar un re-render por sí mismo.
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async (query = "") => {
    const url = query ? `/api/conversations?q=${encodeURIComponent(query)}` : "/api/conversations";
    const res = await fetch(url);
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        setSelectedModel(data.defaultModel ?? "");
        setOllamaOnline(data.source === "ollama");
        setOllamaUrl(data.baseUrl ?? null);
        setOllamaRemote(Boolean(data.remote));
        if (data.error) setError(data.error);
      })
      .catch(() => {
        setOllamaOnline(false);
        setError("No se pudo conectar con Ollama para detectar modelos");
      });

    // El proxy ya garantiza que solo llega acá quien tiene sesión: esto no
    // es un chequeo de acceso, es solo para saber quién es y si es owner.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  // La búsqueda del historial pega contra el servidor (busca también dentro
  // del contenido de los mensajes), así que se espera a que el usuario deje
  // de tipear en vez de disparar una query por tecla.
  //
  // Este mismo efecto hace la carga inicial del historial: con `search` en
  // "" el primer disparo trae la lista completa, y así no hay dos caminos
  // distintos que pisen el mismo estado.
  useEffect(() => {
    const timer = setTimeout(() => refreshConversations(search), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search, refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [exportMenuOpen]);

  // La plataforma no se puede leer durante el render: el servidor no tiene
  // `navigator` y pintaría "Ctrl" donde el cliente pinta "⌘", lo que rompe la
  // hidratación. useSyncExternalStore es la salida prevista para eso: usa el
  // snapshot del servidor para el HTML inicial y recién después lee el del
  // cliente. La plataforma no cambia, así que no hay a qué suscribirse.
  const isMac = useSyncExternalStore(subscribeToNothing, getIsMac, () => false);

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

  function openShortcuts(e?: React.MouseEvent) {
    shortcutsTriggerRef.current =
      (e?.currentTarget as HTMLElement) ?? (document.activeElement as HTMLElement | null);
    setShortcutsOpen(true);
  }

  function closeShortcuts() {
    setShortcutsOpen(false);
    shortcutsTriggerRef.current?.focus();
  }

  function focusSearch() {
    setSidebarCollapsed(false);
    setSidebarOpen(true);
    // El buscador puede estar dentro de un sidebar oculto: enfocarlo antes de
    // que el panel vuelva a pintarse no haría nada.
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }

  function toggleSidebar() {
    // El sidebar se esconde distinto según el ancho (en móvil es un panel
    // encima, en escritorio una columna), así que el atajo tiene que saber
    // cuál de los dos estados mover.
    if (window.matchMedia("(min-width: 768px)").matches) {
      setSidebarCollapsed((v) => !v);
    } else {
      setSidebarOpen((v) => !v);
    }
  }

  // Se refresca después de cada commit para que el listener —registrado una
  // sola vez— siempre lea el estado actual. Sin esto habría que elegir entre
  // re-suscribir el listener en cada tecla o quedarse con un closure viejo,
  // donde `isStreaming` sigue en false y Escape nunca corta la generación.
  useEffect(() => {
    shortcutStateRef.current = {
      isStreaming,
      settingsOpen,
      shortcutsOpen,
      confirmDeleteOpen: confirmDeleteId !== null,
      send: handleSend,
      stop: handleStop,
      newConversation: handleNewConversation,
      focusSearch,
      toggleSidebar,
      toggleShortcuts: () => (shortcutsOpen ? closeShortcuts() : openShortcuts()),
      closeShortcuts,
      closeDelete: closeDeleteModal,
    };
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = shortcutStateRef.current;
      if (!state) return;

      if (e.key === "Escape") {
        // Los diálogos abiertos mandan. El de configuración cierra con su
        // propio Escape, así que acá solo se corta para no encadenar otra
        // acción con la misma tecla.
        if (state.settingsOpen) return;
        if (state.shortcutsOpen) {
          state.closeShortcuts();
          return;
        }
        if (state.confirmDeleteOpen) {
          state.closeDelete();
          return;
        }
        if (state.isStreaming) {
          state.stop();
          return;
        }
        const active = document.activeElement;
        if (isTypingTarget(active)) (active as HTMLElement).blur();
        return;
      }

      if (!hasShortcutModifier(e)) return;

      // Con un diálogo abierto ningún atajo se dispara: no tiene sentido
      // mandar un mensaje o abrir una conversación nueva detrás del modal que
      // el usuario está mirando.
      if (state.settingsOpen || state.shortcutsOpen || state.confirmDeleteOpen) return;

      if (e.key === "Enter") {
        e.preventDefault();
        state.send();
        return;
      }

      // Fuera de ⌘+Enter y Escape, nada se dispara mientras se escribe: en un
      // campo de texto esas teclas ya tienen dueño (⌘+B en negrita, ⌘+/ en un
      // comentario) y robarlas sorprende.
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        state.focusSearch();
      } else if (key === "o" && e.shiftKey) {
        e.preventDefault();
        state.newConversation();
      } else if (key === "b") {
        e.preventDefault();
        state.toggleSidebar();
      } else if (key === "/" || e.code === "Slash") {
        e.preventDefault();
        state.toggleShortcuts();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleNewConversation() {
    // No crea nada todavía: la conversación real se crea recién al enviar el
    // primer mensaje, así el modelo queda libre para cambiarse y no quedan
    // filas vacías en Postgres.
    setError(null);
    setMessages([]);
    setActiveId(null);
    setPendingAttachments([]);
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
    await refreshConversations(search);
  }

  async function handleTogglePin(id: string, pinned: boolean) {
    // Optimista: fijar tiene que sentirse instantáneo, y si falla el próximo
    // refresco devuelve la lista al estado real.
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    await refreshConversations(search);
  }

  async function handleRename(id: string, title: string) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await refreshConversations(search);
  }

  async function handleSelectModel(model: string) {
    setSelectedModel(model);
    // Cambiar de modelo a mitad de conversación se persiste: si no, al
    // recargar volvería al modelo con el que arrancó la charla.
    if (activeId) {
      await fetch(`/api/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
    }
  }

  async function handleOpenSettings(e?: React.MouseEvent) {
    settingsTriggerRef.current = (e?.currentTarget as HTMLElement) ?? (document.activeElement as HTMLElement | null);
    setSettingsOpen(true);
    setSettingsError(null);
    setSettingsLoading(true);
    setInviteError(null);
    setInviteSuccessMessage(null);
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

    // La lista de usuarios solo la puede ver (ni pedir) alguien que no sea
    // owner: pedirla igual solo generaría un 403 inútil.
    if (currentUser?.role === "OWNER") {
      setUsersLoading(true);
      try {
        const res = await fetch("/api/auth/invite");
        const data = await res.json();
        setUsers(data.users ?? []);
      } catch {
        // Silencioso: la sección de usuarios ya tiene su propio estado de
        // carga vacío, y esto no es crítico para el resto del modal.
      } finally {
        setUsersLoading(false);
      }
    }
  }

  // Compartida entre invitar gente nueva y reenviar: el backend ya trata
  // ambos casos igual (POST con un email que ya existe pero no está ACTIVE
  // simplemente genera un token nuevo y reenvía el correo).
  async function inviteEmail(email: string): Promise<boolean> {
    setInviteError(null);
    setInviteSuccessMessage(null);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar la invitación");
      setUsers((prev) => [data.user, ...prev.filter((u) => u.id !== data.user.id)]);
      setInviteSuccessMessage(`Invitación enviada a ${data.user.email}`);
      return true;
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "No se pudo enviar la invitación");
      return false;
    }
  }

  async function handleInvite() {
    const email = newInviteEmail.trim();
    if (!email) return;
    setInviting(true);
    if (await inviteEmail(email)) setNewInviteEmail("");
    setInviting(false);
  }

  async function handleResendInvite(id: string, email: string) {
    setResendingUserId(id);
    await inviteEmail(email);
    setResendingUserId(null);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // El proxy hace el resto: al no encontrar sesión en la próxima carga,
    // manda a /login. Un location.href fuerza esa carga completa (no un
    // router.push de cliente, que dejaría estado viejo en memoria).
    window.location.href = "/login";
  }

  function closeSettingsModal() {
    setSettingsOpen(false);
    settingsTriggerRef.current?.focus();
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

    for (const file of selected) {
      if (SERVER_PARSED.test(file.name)) {
        setUploading(true);
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `No se pudo procesar "${file.name}"`);
          setPendingAttachments((prev) => [...prev, data.attachment]);
          if (data.truncated) {
            setError(`"${file.name}" es muy largo: se adjuntó solo la primera parte.`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : `No se pudo procesar "${file.name}"`);
        } finally {
          setUploading(false);
        }
        continue;
      }

      const isImage = file.type.startsWith("image/");
      const limit = isImage ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES;
      if (file.size > limit) {
        setError(`"${file.name}" supera el límite de ${Math.round(limit / 1024 / 1024) || 1}MB`);
        continue;
      }
      try {
        const attachment = await readFileAsAttachment(file);
        setPendingAttachments((prev) => [...prev, attachment]);
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo leer "${file.name}"`);
      }
    }
  }

  function handleRemoveAttachment(name: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  // Motor único de generación: lo usan enviar, regenerar y editar. La
  // diferencia entre los tres son solo los campos del body y qué mensajes
  // se sacan de la lista antes de arrancar.
  const runGeneration = useCallback(
    async (
      conversationId: string,
      body: Record<string, unknown>,
      optimistic: { user?: Message } = {}
    ) => {
      const assistantId = `local-${Date.now()}-assistant`;
      setMessages((prev) => [
        ...prev,
        ...(optimistic.user ? [optimistic.user] : []),
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setStatus(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, ...body }),
          signal: controller.signal,
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
            if (event.type === "status") {
              setStatus(event.text || null);
            } else if (event.type === "error") {
              setError(event.message);
            } else if (event.type === "sources") {
              const sources: Source[] = event.sources;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
              );
            } else if (event.type === "thinking") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, thinking: (m.thinking ?? "") + event.text } : m
                )
              );
            } else if (event.type === "thinking-done") {
              // Llega apenas arranca el contenido visible, no al final de la
              // respuesta: así el encabezado pasa de "Pensando…" a "Pensó N s"
              // mientras el resto de la respuesta todavía se está generando.
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, thinkingMs: event.ms } : m))
              );
            } else if (event.type === "token") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.text } : m
                )
              );
            }
          }
        }
      } catch (err) {
        // Abortar es una acción del usuario, no un error que mostrarle.
        if ((err as Error)?.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setStatus(null);
        refreshConversations(search);
      }
    },
    [refreshConversations, search]
  );

  async function ensureConversation(): Promise<string | null> {
    if (activeId) return activeId;
    const res = await fetch("/api/conversations", {
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
    await refreshConversations(search);
    return data.conversation.id as string;
  }

  async function handleSend() {
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;
    // Se activa acá, antes del primer await: si no, la ventana asíncrona de
    // crear la conversación deja el botón habilitado y un segundo clic
    // duplica la conversación con el mismo primer mensaje.
    setIsStreaming(true);

    const conversationId = await ensureConversation();
    if (!conversationId) {
      setIsStreaming(false);
      return;
    }

    const userText = input;
    const attachments = pendingAttachments;
    setInput("");
    setPendingAttachments([]);

    await runGeneration(
      conversationId,
      { message: userText, attachments, webSearch },
      {
        user: {
          id: `local-${Date.now()}`,
          role: "user",
          content: userText,
          attachments,
        },
      }
    );
  }

  async function handleRegenerate(messageId: string) {
    if (!activeId || isStreaming) return;
    setIsStreaming(true);
    // El mensaje del asistente que se rehace y todo lo posterior desaparecen
    // de la vista antes de pedir la respuesta nueva; el servidor los borra
    // de la base en el mismo pedido.
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) setMessages(messages.slice(0, index));
    await runGeneration(activeId, { regenerateFrom: messageId, webSearch });
  }

  async function handleEdit(messageId: string, newText: string) {
    if (!activeId || isStreaming || !newText.trim()) return;
    setIsStreaming(true);
    const index = messages.findIndex((m) => m.id === messageId);
    const original = messages[index];
    if (index !== -1) setMessages(messages.slice(0, index));
    await runGeneration(
      activeId,
      {
        editMessageId: messageId,
        message: newText,
        attachments: original?.attachments ?? [],
        webSearch,
      },
      {
        user: {
          id: `local-${Date.now()}`,
          role: "user",
          content: newText,
          attachments: original?.attachments ?? [],
        },
      }
    );
  }

  function handleExport(format: ExportFormat) {
    const conversation = conversations.find((c) => c.id === activeId);
    exportConversation(format, conversation, messages);
    setExportMenuOpen(false);
  }

  const ready = models.length > 0;
  const hasMessages = messages.length > 0;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  const composer = (
    <Composer
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onStop={handleStop}
      isStreaming={isStreaming}
      disabled={!ready}
      attachments={pendingAttachments}
      onAttach={handleFilesSelected}
      onRemoveAttachment={handleRemoveAttachment}
      webSearch={webSearch}
      onToggleWebSearch={() => setWebSearch((v) => !v)}
      models={models}
      selectedModel={selectedModel}
      onSelectModel={handleSelectModel}
      uploading={uploading}
    />
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--void)] font-[family-name:var(--font-body)] text-[var(--ink)]">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      {/* El fondo oscuro del drawer mobile lo pinta el propio Sidebar (ver
          su prop `open`): duplicarlo acá oscurecía el doble y el de arriba
          se comía los clics del de abajo. */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={handleNewConversation}
        onSelect={handleSelectConversation}
        onRequestDelete={handleRequestDelete}
        onTogglePin={handleTogglePin}
        onRename={handleRename}
        onOpenSettings={handleOpenSettings}
        onOpenShortcuts={openShortcuts}
        search={search}
        onSearchChange={setSearch}
        searchInputRef={searchInputRef}
        collapsed={sidebarCollapsed}
        ollamaOnline={ollamaOnline}
        ollamaUrl={ollamaUrl}
        ollamaRemote={ollamaRemote}
        currentUserEmail={currentUser?.email ?? null}
        onLogout={handleLogout}
      />

      {/* tabIndex -1 para que el enlace "saltar al contenido" tenga dónde
          aterrizar: un <main> sin él recibe el hash pero no el foco, y el
          Tab siguiente arrancaría otra vez desde el principio de la página. */}
      <main id="contenido" tabIndex={-1} className="relative z-10 flex flex-1 flex-col outline-none">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-4 md:px-8">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Mostrar historial de conversaciones"
              title="Mostrar historial de conversaciones"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:border-[var(--accent)]/40 md:flex focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir historial de conversaciones"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:border-[var(--accent)]/40 md:hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]">
              {conversations.find((c) => c.id === activeId)?.title ?? "Nueva conversación"}
            </p>
            <p className="text-xs text-[var(--ink-dim)]">
              {/* Un Ollama remoto ya saca los mensajes de la máquina aunque
                  el modelo no sea "-cloud": no se puede prometer privacidad
                  local solo porque el nombre del modelo no diga cloud. */}
              {ollamaRemote
                ? "Ollama remoto: tus mensajes salen de tu máquina."
                : selectedModel && isCloudModel(selectedModel)
                ? "Modelo en la nube: tus mensajes salen de tu máquina."
                : "Servido por tu Ollama local."}
              {webSearch ? " Búsqueda web activada." : ""}
            </p>
          </div>
          {hasMessages && (
            <div className="relative ml-auto" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                aria-label="Exportar conversación"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                title="Exportar conversación"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-dim)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2v8m0 0L5 7m3 3l3-3M3 12v1.5A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5V12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {exportMenuOpen && (
                <div
                  role="menu"
                  className="msg-enter absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)]"
                >
                  {(Object.entries(EXPORT_FORMAT_LABELS) as [ExportFormat, string][]).map(
                    ([format, label]) => (
                      <button
                        key={format}
                        type="button"
                        role="menuitem"
                        onClick={() => handleExport(format)}
                        className="block w-full px-3 py-2 text-left text-sm text-[var(--ink)] transition-colors hover:bg-[var(--panel-2)] focus-visible:bg-[var(--panel-2)] focus-visible:outline-none"
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {!hasMessages && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-8 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)]">
                ¿En qué estás pensando?
              </p>
              <p className="max-w-sm text-sm text-[var(--ink-dim)]">
                Escribí lo que quieras, adjuntá un PDF o activá la búsqueda web para
                que la respuesta venga con fuentes.
              </p>
            </div>

            <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  disabled={!ready}
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-left text-[13px] text-[var(--ink-dim)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {composer}
            {error && (
              <div className="w-full max-w-2xl rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700">
                <span className="mr-1 text-red-500">⚠</span>
                {error}
              </div>
            )}
          </div>
        )}

        {hasMessages && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
              {/* role="log" + aria-live="polite": el lector de pantalla lee lo
                  que se va agregando cuando termina lo que estaba diciendo, en
                  vez de interrumpir a cada token como haría "assertive". */}
              <div
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label="Mensajes de la conversación"
                className="mx-auto flex max-w-2xl flex-col gap-5"
              >
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isStreaming={isStreaming && message.id === lastAssistantId}
                    canAct={!isStreaming}
                    onRegenerate={() => handleRegenerate(message.id)}
                    onEdit={(newText) => handleEdit(message.id, newText)}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {status && (
              <div className="mx-4 mb-2 md:mx-8">
                <p className="mx-auto max-w-2xl text-xs text-[var(--ink-dim)]">
                  <span className="shimmer-text">{status}</span>
                </p>
              </div>
            )}

            {error && (
              <div className="mx-4 mb-3 md:mx-8">
                <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700">
                  <span className="mt-0.5 text-red-500">⚠</span>
                  {error}
                </div>
              </div>
            )}

            <div className="px-4 pb-8 pt-2 md:px-8">{composer}</div>
          </>
        )}
      </main>

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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

      <SettingsModal
        open={settingsOpen}
        onClose={closeSettingsModal}
        systemPrompt={systemPrompt}
        systemPromptDraft={systemPromptDraft}
        onSystemPromptDraftChange={setSystemPromptDraft}
        onSaveSystemPrompt={handleSaveSystemPrompt}
        memories={memories}
        newMemoryText={newMemoryText}
        onNewMemoryTextChange={setNewMemoryText}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        loading={settingsLoading}
        saving={settingsSaving}
        error={settingsError}
        isOwner={currentUser?.role === "OWNER"}
        users={users}
        usersLoading={usersLoading}
        newInviteEmail={newInviteEmail}
        onNewInviteEmailChange={setNewInviteEmail}
        onInvite={handleInvite}
        inviting={inviting}
        inviteError={inviteError}
        inviteSuccessMessage={inviteSuccessMessage}
        resendingUserId={resendingUserId}
        onResendInvite={handleResendInvite}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={closeShortcuts}
        isMac={isMac}
        onTabTrap={handleModalTabTrap}
      />
    </div>
  );
}

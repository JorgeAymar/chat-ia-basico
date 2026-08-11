// Definición y formato de los atajos de teclado globales.
//
// El listener vive en page.tsx (uno solo para toda la app); acá quedan las
// piezas puras, que son las que conviene poder testear y reusar en el modal
// de ayuda sin arrastrar el DOM.

// La tecla que abre los atajos: ⌘ en macOS, Ctrl en el resto. Se acepta
// cualquiera de las dos porque un teclado externo puede no coincidir con el
// sistema, y confundirse de modificador no debería "tragar" la tecla.
export function hasShortcutModifier(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

// Mientras se escribe, las letras son texto y no comandos: sin este filtro,
// tipear una "b" en el buscador escondería el historial. Los atajos que sí
// deben funcionar adentro de un campo (⌘+Enter, Escape) se resuelven antes
// de consultar esto.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// "mod" se resuelve recién al pintar, cuando ya se sabe la plataforma.
export type ShortcutKey = "mod" | "shift" | (string & {});

export type ShortcutDef = {
  keys: ShortcutKey[];
  description: string;
};

export const SHORTCUTS: ShortcutDef[] = [
  { keys: ["mod", "K"], description: "Buscar entre las conversaciones" },
  { keys: ["mod", "shift", "O"], description: "Empezar una conversación nueva" },
  { keys: ["mod", "B"], description: "Mostrar u ocultar el historial" },
  { keys: ["mod", "/"], description: "Abrir o cerrar esta ayuda" },
  { keys: ["mod", "Enter"], description: "Enviar el mensaje" },
  { keys: ["Enter"], description: "Enviar el mensaje" },
  { keys: ["shift", "Enter"], description: "Salto de línea sin enviar" },
  { keys: ["Escape"], description: "Detener la respuesta, cerrar un diálogo o salir del campo de texto" },
];

export function formatKey(key: ShortcutKey, isMac: boolean): string {
  if (key === "mod") return isMac ? "⌘" : "Ctrl";
  if (key === "shift") return isMac ? "⇧" : "Shift";
  if (key === "Escape") return "Esc";
  return key;
}

export function formatShortcut(keys: ShortcutKey[], isMac: boolean): string {
  return keys.map((k) => formatKey(k, isMac)).join(isMac ? " " : " + ");
}

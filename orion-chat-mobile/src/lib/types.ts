// Copia literal de src/lib/types.ts (el cliente web) — ver el comentario en
// mobile/src/lib/stream.ts sobre por qué está duplicado en vez de importado.
//
// Tipos compartidos entre la UI y las rutas de API. Viven acá y no en
// page.tsx para que los componentes puedan importarlos sin arrastrar el
// estado del cliente.

import type { Source } from "./stream";

export type Role = "user" | "assistant";

export type Attachment = {
  name: string;
  kind: "text" | "image";
  mimeType: string;
  // "text": contenido plano. "image": base64 sin el prefijo data:.
  content: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  // Razonamiento del modelo, plegado en la UI.
  thinking?: string | null;
  // Cuánto duró ese razonamiento, medido en el servidor. Null en los mensajes
  // guardados antes de que existiera la columna.
  thinkingMs?: number | null;
  // Fuentes web citadas en la respuesta.
  sources?: Source[] | null;
  attachments?: Attachment[] | null;
  model?: string | null;
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  updatedAt: string;
};

export type Memory = {
  id: string;
  content: string;
  createdAt: string;
};

export type UserRole = "OWNER" | "MEMBER";
export type UserStatus = "INVITED" | "ACTIVE";

// Sesión actual (GET /api/auth/me). Deliberadamente mínimo: solo lo que la
// UI necesita para decidir qué mostrar, no el registro completo de User.
export type Theme = "light" | "dark";

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  // Preferencia de apariencia guardada en el perfil. Opcional: un backend
  // viejo que todavía no la devuelve no debería romper el cliente.
  theme?: Theme;
};

// Fila de la tabla de usuarios invitados/activos (GET /api/auth/invite),
// visible solo para el owner.
export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  acceptedAt: string | null;
};

export type { Source };

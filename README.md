# Chat-IA — chat local con Ollama

App de chat conectada a un modelo de Ollama corriendo en `localhost`, con historial de conversaciones persistido en Postgres. Proyecto personal, corre 100% en tu máquina (salvo que elijas explícitamente un modelo `-cloud` de Ollama).

## Stack técnico

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Prisma 6** como ORM, cliente generado en `src/generated/prisma`
- **Postgres 16** (contenedor Docker, no instalado en el sistema)
- **Tailwind CSS 4** para estilos
- **Ollama** como backend de inferencia (API `/api/tags` y `/api/chat`), no incluido en el repo — se instala y corre aparte
- Sin autenticación, sin multiusuario: es una app de un solo usuario

## Levantar la app desde cero

```bash
# 1. Base de datos (Postgres en Docker, puerto 5435)
docker compose up -d

# 2. Variables de entorno
cp .env.example .env
# revisá/ajustá DATABASE_URL, OLLAMA_BASE_URL, OLLAMA_DEFAULT_MODEL

# 3. Migraciones de Prisma (crea las tablas)
npx prisma migrate dev

# 4. Ollama corriendo en local, con al menos un modelo instalado
ollama serve
ollama pull llama3   # o el modelo que prefieras

# 5. Dependencias y servidor de desarrollo
npm install
npm run dev
```

La app queda en `http://localhost:3000`.

**Nota sobre el puerto de Postgres:** `docker-compose.yml` publica el contenedor en el puerto **5435** del host (no 5432 ni 5433), justamente para no chocar con otros Postgres que puedan estar corriendo en la máquina. `DATABASE_URL` en `.env.example` ya apunta a `localhost:5435`.

## Variables de entorno (`.env`)

| Variable | Qué hace |
|---|---|
| `DATABASE_URL` | Cadena de conexión a Postgres. Por defecto `postgresql://chatuser:chatpass@localhost:5435/chat_ia_basico?schema=public`, coincide con las credenciales del `docker-compose.yml`. |
| `OLLAMA_BASE_URL` | URL base del servidor Ollama. Por defecto `http://localhost:11434`. |
| `OLLAMA_DEFAULT_MODEL` | Modelo preseleccionado al abrir la app, **solo si está instalado** en Ollama. Opcional: si no está seteado o el modelo no existe, se usa el primero que devuelva Ollama. |

**Importante — esto cambió recientemente:** la lista de modelos disponibles en el selector **ya no se configura por `.env`**. Antes existía una variable tipo `OLLAMA_MODELS` como allow-list; ya no se usa. Hoy la app llama en vivo a `GET /api/tags` de Ollama (equivalente a `ollama list`) cada vez que carga, así que si hacés `ollama pull`/`ollama rm` los cambios se reflejan al instante sin tocar código ni reiniciar nada. Si ves referencias a `OLLAMA_MODELS` en documentación vieja, son obsoletas.

## Funcionalidades

- **Chat con streaming**: las respuestas del modelo se van mostrando token por token (vía `ReadableStream`, sin WebSockets).
- **Historial persistente**: cada conversación se guarda en Postgres con título auto-generado a partir del primer mensaje del usuario (truncado a 45 caracteres, o `📎 nombre-archivo` si el primer mensaje solo trae adjuntos).
- **Adjuntar archivos**: hasta 5 por mensaje.
  - Texto/código (`.md`, `.json`, `.csv`, `.log`, `.js`, `.ts`, `.py`, etc.): máx. 300KB por archivo en el navegador, y se trunca a 20.000 caracteres antes de mandarlo al modelo. Se inyecta como bloque citado en el mensaje.
  - Imágenes: máx. 5MB por archivo, se codifican en base64 y se mandan al array `images` de la API multimodal de Ollama.
- **Borrar conversaciones**: botón de papelera por conversación en el historial, con un modal de confirmación propio (no `window.confirm`) que avisa que la acción no se puede deshacer.
- **Indicador de conexión con Ollama**: punto verde/rojo en la sidebar (conectado/desconectado), más la URL de Ollama detectada debajo del título.
- **Aviso de modelo cloud**: si el modelo activo termina en `-cloud`/`:cloud` (modelos que Ollama proxea hacia sus propios servidores), la UI muestra la etiqueta de texto "(cloud)" en el selector y un texto explícito avisando que ese chat sí sale de la máquina — a diferencia de los modelos locales.
- **Configuración (botón de engranaje ⚙)**:
  - **Prompt de sistema**: editable desde la UI, se persiste en el archivo `SYSTEM_PROMPT.md` en la raíz del proyecto (no en la base de datos). Se envía como mensaje `role: system` en cada llamada a Ollama.
  - **Memoria persistente**: notas de texto libre (máx. 500 caracteres, máx. 100 notas) que se guardan en Postgres (`Memory`) y se recuerdan en **todas** las conversaciones, no solo en la actual. Se agregan al prompt de sistema como una lista con encabezado "Cosas que sabés sobre el usuario".

## Estructura del proyecto

```
src/
  app/
    page.tsx                       UI completa: sidebar/historial, composer, adjuntos,
                                    modal de borrado, modal de configuración, selector de modelo
    layout.tsx                     layout raíz, fuentes (IBM Plex Sans + Plus Jakarta Sans), metadata
    globals.css                    estilos globales / variables de tema (Tailwind 4)
    api/
      models/route.ts              GET: modelos detectados en vivo desde Ollama + modelo por defecto
      conversations/route.ts       GET lista de conversaciones / POST crea una nueva
      conversations/[id]/route.ts  GET detalle con mensajes / DELETE borra la conversación
      chat/route.ts                POST: arma el historial, llama a Ollama en streaming, persiste
                                    el mensaje del usuario y la respuesta del asistente
      settings/route.ts            GET/PUT del prompt de sistema (lee/escribe SYSTEM_PROMPT.md)
      memory/route.ts              GET lista de notas de memoria / POST agrega una
      memory/[id]/route.ts         DELETE borra una nota de memoria
  lib/
    ollama.ts                      cliente de Ollama: detección de modelos (/api/tags), streaming
                                    de /api/chat (NDJSON → texto plano), armado de mensajes multimodales
    settings.ts                    lectura/escritura de SYSTEM_PROMPT.md con prompt por defecto
    prisma.ts                      instancia singleton de PrismaClient
  generated/prisma/                cliente de Prisma generado (no editar a mano)
prisma/
  schema.prisma                    modelos Conversation, Message, Memory
  migrations/                      migraciones de Prisma
docker-compose.yml                 contenedor de Postgres 16 (puerto host 5435)
.env.example                       plantilla de variables de entorno
SYSTEM_PROMPT.md                   prompt de sistema activo (editable desde la app o a mano)
```

## Modelo de datos (Prisma)

- **`Conversation`**: `id`, `title` (default `"Nueva conversación"`), `model` (nombre del modelo Ollama usado), `createdAt`, `updatedAt`, y su relación `messages`. Se crea recién al enviar el primer mensaje (no al hacer clic en "Nueva conversación"), para no dejar filas vacías.
- **`Message`**: `id`, `conversationId`, `role` (`user` | `assistant`), `content`, `model` (opcional, se guarda en los mensajes del asistente), `attachments` (JSON opcional — array de `{ name, kind: "text"|"image", mimeType, content }`), `createdAt`. Se borra en cascada al borrar la conversación.
- **`Memory`**: `id`, `content`, `createdAt`. Notas sueltas, sin relación con ninguna conversación — es memoria global del asistente, independiente del historial.

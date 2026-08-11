# Orion Chat

Chat conectado a Ollama, con historial persistido en Postgres y búsqueda web con citas vía SearXNG. Proyecto personal de un solo usuario, sin autenticación.

## Stack técnico

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Prisma 6** como ORM, cliente generado en `src/generated/prisma`
- **Postgres 16** y **SearXNG**, ambos en contenedores Docker
- **Tailwind CSS 4** para estilos
- **Ollama** como backend de inferencia — local (`ollama serve`) o remoto detrás de un proxy con token
- `react-markdown` + `remark-gfm` + `KaTeX` + `highlight.js` para el render de las respuestas
- `unpdf` y `mammoth` para extraer texto de PDF y DOCX en el servidor

## Levantar la app desde cero

```bash
# 1. Infraestructura: Postgres (5436) y SearXNG (8080)
docker compose up -d

# 2. Variables de entorno
cp .env.example .env
# ajustá OLLAMA_BASE_URL y, si tu Ollama pide token, OLLAMA_API_KEY

# 3. Migraciones de Prisma
npx prisma migrate dev

# 4. Ollama con al menos un modelo (si usás uno local)
ollama serve
ollama pull llama3

# 5. Dependencias y servidor de desarrollo
npm install
npm run dev
```

La app queda en `http://localhost:3000` (o el primer puerto libre).

**Puertos:** Postgres se publica en el **5436** del host y SearXNG en el **8080**, atado a `127.0.0.1`. El 5436 se eligió porque 5432/5433/5435 suelen estar tomados por otros proyectos.

## Variables de entorno (`.env`)

| Variable | Qué hace |
|---|---|
| `NEXT_PUBLIC_APP_NAME` | Nombre que muestra la UI y la pestaña del navegador. |
| `NEXT_PUBLIC_APP_VERSION` | Versión que se muestra junto al nombre en el sidebar. |
| `DATABASE_URL` | Conexión a Postgres. Por defecto apunta a `localhost:5436`, que coincide con `docker-compose.yml`. |
| `OLLAMA_BASE_URL` | URL de Ollama. Puede ser `http://localhost:11434` o un host remoto. |
| `OLLAMA_API_KEY` | Token bearer, solo si Ollama está detrás de un proxy que lo exige. Vacío con Ollama local. |
| `OLLAMA_DEFAULT_MODEL` | Modelo preseleccionado al abrir la app, si está instalado. Opcional. |
| `SEARXNG_BASE_URL` | URL de SearXNG. Si no está levantado, el botón de búsqueda avisa y el chat responde igual sin buscar. |

Las dos `NEXT_PUBLIC_*` las incrusta Next en el bundle al compilar, así que después de cambiarlas hay que reiniciar el servidor: recargar el navegador no alcanza.

La lista de modelos del selector **no se configura por `.env`**: sale en vivo de `GET /api/tags` de Ollama en cada carga, así que `ollama pull`/`ollama rm` se reflejan al instante.

## Funcionalidades

### Conversación

- **Streaming con eventos tipados.** El endpoint de chat devuelve NDJSON —un evento JSON por línea— en vez de texto plano, porque en el mismo stream conviven cuatro cosas distintas: tokens, razonamiento, fuentes web y avisos de progreso. El protocolo está en `src/lib/stream.ts`.
- **Markdown completo** en las respuestas: encabezados, listas, tablas, citas, fórmulas con KaTeX y bloques de código con resaltado de sintaxis y botón de copiar.
- **Detener la generación** a mitad de camino. Lo generado hasta ese momento se guarda igual: media respuesta útil es mejor que perderla.
- **Regenerar** una respuesta y **editar** un mensaje ya enviado. Ambas cosas recortan la conversación hasta ese punto y vuelven a generar desde ahí.
- **Copiar** cualquier respuesta al portapapeles.
- **Bloque de razonamiento plegable** para los modelos que piensan (deepseek-r1, qwen3, gpt-oss). Se muestra abierto mientras se genera y se pliega solo al terminar. El razonamiento se guarda en su propia columna y **no** se reinyecta como contexto en los turnos siguientes: infla el prompt y hace que el modelo lea su propio borrador como si fuera la respuesta.
- **Composer multilínea**: Enter envía, Shift+Enter salta de línea, y el campo crece con el texto hasta 200px.
- **Cambiar de modelo a mitad de conversación**, y el cambio se persiste.

### Búsqueda web con citas

El botón del globo en el composer activa la búsqueda. El servidor consulta SearXNG, se queda con el mejor resultado por dominio (si no, seis páginas del mismo sitio copan las citas), inyecta los extractos numerados en el prompt y le pide al modelo que cite con marcadores `[1]`, `[2]`. Esos marcadores se convierten en enlaces a las fuentes, y debajo de la respuesta aparece la lista completa con título, dominio y extracto.

Si SearXNG no responde, se avisa y el modelo contesta igual con lo que sabe: la búsqueda nunca puede romper el chat.

### Archivos adjuntos

Hasta 5 por mensaje.

| Tipo | Límite | Cómo se procesa |
|---|---|---|
| Texto y código (`.md`, `.json`, `.ts`, `.py`…) | 300KB | Se lee en el navegador, se trunca a 20.000 caracteres |
| Imágenes | 5MB | Base64 al array `images` de la API multimodal de Ollama |
| **PDF** | 10MB / 150 páginas | Se extrae en el servidor con `unpdf`, marcando cada página |
| **DOCX** | 10MB | Se extrae en el servidor con `mammoth` |

El truncado de documentos corta por página o sección, nunca a mitad de palabra, y deja una marca explícita de lo que quedó afuera para que el modelo sepa que no tiene todo. Si un PDF no tiene capa de texto (escaneado), se rechaza con un mensaje accionable en vez de mandarle una cadena vacía al modelo, que lo llevaría a inventar.

### Historial

- **Buscar** en el historial, tanto por título como por el contenido de los mensajes: el título sale del primer mensaje y casi nunca resume bien lo que se terminó hablando.
- **Fijar** conversaciones arriba de todo.
- **Renombrar** con doble clic sobre el título.
- **Borrar** con un modal de confirmación propio.
- **Exportar** la conversación a Markdown, con las fuentes incluidas.

### Configuración (⚙)

- **Prompt de sistema** editable, persistido en `SYSTEM_PROMPT.md`.
- **Memoria persistente**: notas de texto libre que el asistente recuerda en todas las conversaciones, no solo en la actual.

### Privacidad

La app es explícita sobre dónde corre el modelo, porque no siempre puede prometer que el chat se queda en tu máquina:

- Ollama en localhost con un modelo local → el badge dice **local**.
- Ollama en un host remoto → dice **remoto**, y el encabezado aclara que los mensajes salen de tu máquina, aunque el modelo no se llame `-cloud`.
- Modelos `-cloud`/`:cloud` → Ollama los proxea a sus propios servidores, y la UI lo avisa.

Con la búsqueda web activada, la consulta sale hacia SearXNG y de ahí a los buscadores.

## Estructura del proyecto

```
src/
  app/
    page.tsx                       Orquestador: estado, streaming, acciones
    layout.tsx                     Layout raíz, fuentes, CSS de KaTeX
    globals.css                    Tema, estilos de Markdown y del resaltado
    api/
      models/route.ts              GET modelos en vivo desde Ollama
      conversations/route.ts       GET lista (con búsqueda) / POST crear
      conversations/[id]/route.ts  GET detalle / PATCH renombrar-fijar-modelo / DELETE
      chat/route.ts                POST: búsqueda web, streaming NDJSON, persistencia
      upload/route.ts              POST: extrae texto de PDF y DOCX
      settings/route.ts            GET/PUT del prompt de sistema
      memory/route.ts              GET/POST de las notas de memoria
      memory/[id]/route.ts         DELETE de una nota
  components/
    Markdown.tsx                   Render memoizado por bloque + código con copiar
    ChatMessage.tsx                Burbuja, adjuntos y acciones del mensaje
    Composer.tsx                   Campo multilínea, adjuntos, búsqueda, modelo
    Sidebar.tsx                    Historial con búsqueda, fijadas y renombrado
    Sources.tsx                    Lista de fuentes citadas
    ThinkingBlock.tsx              Razonamiento plegable
    SettingsModal.tsx              Prompt de sistema y memoria
  lib/
    stream.ts                      Protocolo NDJSON y separador de <think>
    ollama.ts                      Cliente de Ollama (modelos y streaming)
    search.ts                      Cliente de SearXNG y armado del contexto
    documents.ts                   Extracción de PDF y DOCX
    markdown-blocks.ts             Corte en bloques para memoizar el streaming
    model-utils.ts, settings.ts, prisma.ts, types.ts
searxng/settings.yml               Config de SearXNG (leé el comentario de arriba)
```

## Tests

```bash
npm test         # unitarios con Jest
npm run test:e2e # end-to-end con Playwright
```

## Detalles de implementación que vale conocer

**El streaming se corta en bloques para memoizar.** Si se le pasa el mensaje entero a `react-markdown` en cada token, vuelve a parsear todo el texto cada vez: es cuadrático y se nota como tirones. `markdown-blocks.ts` parte el Markdown en bloques de nivel superior —respetando los bloques de código, donde una línea en blanco no separa nada— y solo se re-parsea el último.

**Los bloques de código sin cerrar se cierran de mentira mientras llegan.** Si no, el fence abierto se renderiza como párrafo con los backticks a la vista y salta a bloque de código de golpe cuando llega el cierre.

**Las etiquetas `<think>` llegan partidas entre chunks.** El `ThinkingSplitter` nunca emite la cola del buffer que todavía podría ser el principio de una etiqueta, así que nunca se ve un `<thi` suelto en pantalla.

**Ollama reporta errores a mitad de stream con HTTP 200.** Cuando falla después de empezar a responder, manda una línea suelta `{"error":"..."}` dentro del NDJSON. Ignorarla haría que el chat corte a mitad de frase sin explicar por qué, así que se convierte en excepción y llega al cliente como evento de error.

**Un Ollama caído no debe parecer un modelo desinstalado.** La validación del modelo solo rechaza si Ollama efectivamente devolvió su lista y el modelo no está en ella; si no respondió, se sigue y el error real lo reporta la llamada de chat.

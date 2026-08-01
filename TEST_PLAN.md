# Plan de pruebas — Chat-IA (chat-ia-basico)

Generado explorando la app real con Playwright (`http://localhost:3000`), leyendo el código fuente completo, y auditando dependencias y valores hardcodeados. Este documento es **solo el plan** — no implementa tests todavía.

---

## 1. Inventario de UI relevado

Explorado en vivo con Playwright (desktop 1440×900 y mobile 390×844).

### Pantalla principal (estado vacío, sin conversación activa)
| Elemento | Detalle |
|---|---|
| Botón ⚙ Configuración | `aria-label="Configuración"`, abre modal |
| Botón + Nueva conversación | resetea estado local, no crea fila en DB |
| Lista de historial (sidebar) | botones por conversación, cada uno con sub-botón "Borrar" (aparece en hover/focus) |
| Botón hamburguesa (mobile only, `md:hidden`) | `aria-label="Abrir historial de conversaciones"` |
| Input de mensaje | placeholder "Escribe tu mensaje…", deshabilitado si no hay modelos |
| Botón adjuntar archivo | `aria-label="Adjuntar archivo"`, abre `<input type="file" multiple>` oculto |
| Input file oculto | `accept="image/*,text/*,.md,.json,.csv,.log,.js,.ts,.tsx,.jsx,.py,.go,.rb,.java,.c,.cpp,.h,.css,.html,.yml,.yaml"`, `multiple` |
| Botón enviar | `aria-label="Enviar mensaje"`, deshabilitado sin texto/adjuntos o mientras streamea |
| Selector de modelo (`<select>`) | debajo del composer, 10 opciones detectadas en vivo de Ollama, con la etiqueta de texto "(cloud)" si es modelo `-cloud` |
| Indicador de estado Ollama | punto verde/rojo + badge "local"/"sin conexión" + URL de Ollama visible en texto mono |

### Modal de Configuración (`role="dialog"`)
| Elemento | Detalle |
|---|---|
| Textarea prompt de sistema | precargado desde `SYSTEM_PROMPT.md` |
| Botón Guardar | deshabilitado si no hay cambios pendientes; persiste en el `.md` |
| Input + botón Agregar (memoria) | crea nota en tabla `Memory` |
| Lista de notas de memoria | cada una con botón "×" para borrar |
| Botón cerrar (×) | cierra modal, devuelve foco al botón que lo abrió |
| Escape / Tab trap | implementado (cierra con Escape, atrapa el foco dentro del modal) |

### Modal de borrar conversación (`role="alertdialog"`)
| Elemento | Detalle |
|---|---|
| Título + nombre de la conversación a borrar | dinámico |
| Botón Cancelar | cierra sin borrar |
| Botón Borrar | `DELETE /api/conversations/[id]`, refresca sidebar |

### Vista con conversación activa
- Burbujas de usuario (derecha, fondo índigo sólido, texto blanco) y asistente (izquierda, avatar "A", borde sutil).
- Adjuntos en burbujas: miniatura para imágenes, chip con ícono de documento para texto.
- Indicador de "escribiendo" (3 puntos pulsantes) mientras streamea.
- Selector de modelo se deshabilita con conversación activa.
- Banner de error (⚠) rojo cuando algo falla.

### Mobile (< 768px)
- Sidebar oculta por defecto, aparece como overlay con backdrop al tocar el hamburguesa.
- Resto del layout se apila correctamente (confirmado por captura).

---

## 2. Plan de pruebas funcionales (end-to-end)

Convención de ID: `F-<área>-<número>`.

### F-CHAT — Conversación
- **F-CHAT-01**: enviar el primer mensaje crea la conversación en Postgres (antes no existía) y el título se auto-genera desde el texto (máx. 45 chars, con "…" si se trunca).
- **F-CHAT-02**: enviar un mensaje sin texto pero con adjuntos genera título `📎 nombre-archivo`.
- **F-CHAT-03**: streaming de la respuesta se renderiza token a token; al finalizar, ambos mensajes (user + assistant) quedan persistidos.
- **F-CHAT-04**: multi-turno (5+ mensajes seguidos) no pierde, duplica ni reordena mensajes.
- **F-CHAT-05**: doble click rápido en "Enviar" no duplica el mensaje del usuario (falla si el botón no se deshabilita a tiempo).
- **F-CHAT-06**: navegar a otra conversación (o recargar la página) mientras la respuesta está streameando NO pierde la respuesta — debe quedar guardada en Postgres igual, visible al volver.
- **F-CHAT-07**: recargar la página y reabrir una conversación desde el sidebar restaura el historial completo, idéntico al que se veía antes de recargar.
- **F-CHAT-08**: mensaje vacío (sin texto y sin adjuntos) no dispara el envío.
- **F-CHAT-09**: seleccionar una conversación existente carga su modelo original en el selector (y lo deja deshabilitado).
- **F-CHAT-10**: "Nueva conversación" desde una conversación activa vuelve al estado vacío, rehabilita el selector de modelo, y NO crea una fila vacía en la tabla `Conversation` (regresión: este fue un bug real ya corregido).
- **F-CHAT-11**: si Ollama devuelve error (modelo no disponible, timeout, 502), se muestra el banner de error explícito y el mensaje del usuario **no** queda huérfano sin respuesta silenciosa.

### F-MODEL — Selección y detección de modelos
- **F-MODEL-01**: al cargar la app, `GET /api/models` refleja exactamente lo que devuelve `ollama list` / `GET /api/tags` — sin filtrar por `.env` (comportamiento reciente, reemplazó la vieja allow-list `OLLAMA_MODELS`).
- **F-MODEL-02**: modelos con sufijo `-cloud`/`:cloud` muestran la etiqueta "(cloud)" en el dropdown y activan el aviso "tus mensajes sí salen de tu máquina" en el header y en el estado vacío.
- **F-MODEL-03**: si Ollama está caído al cargar la app, `ollamaOnline` pasa a `false`, el punto se pone rojo, el badge dice "sin conexión", y se muestra un error legible (no una pantalla rota).
- **F-MODEL-04**: cambiar el modelo en el dropdown antes de enviar el primer mensaje debe reflejarse en la conversación que se crea.

### F-ATTACH — Adjuntos
- **F-ATTACH-01**: adjuntar un archivo de texto (`.txt`, `.md`, código) muestra un chip con el nombre antes de enviar.
- **F-ATTACH-02**: el modelo recibe el contenido del archivo como contexto citado y puede responder preguntas sobre él (ya validado: "¿cuál es el número secreto?" → el modelo lo lee correctamente).
- **F-ATTACH-03**: adjuntar una imagen con un modelo con soporte de visión (ej. `kimi-k2.6:cloud`) permite que el modelo describa la imagen correctamente.
- **F-ATTACH-04**: adjuntar una imagen con un modelo SIN soporte de visión produce un error explícito (502 manejado), no un colgado silencioso de la UI.
- **F-ATTACH-05**: límites de tamaño se respetan: imagen > 5MB o texto > 300KB se rechaza en el cliente con mensaje de error, antes de intentar subir.
- **F-ATTACH-06**: más de 5 archivos en un mismo mensaje → el excedente se recorta con aviso.
- **F-ATTACH-07**: quitar un adjunto pendiente (botón "×" en el chip) lo saca de la lista antes de enviar.
- **F-ATTACH-08**: (bug conocido, ver sección 5) dos archivos con el mismo `name` en la misma selección colisionan en key/estado — validar y, si aplica, corregir.
- **F-ATTACH-09**: los adjuntos persisten en `Message.attachments` (JSON) y se recuperan correctamente al reabrir la conversación (imagen se re-renderiza, chip de texto reaparece).

### F-DEL — Borrado de conversaciones
- **F-DEL-01**: click en el ícono de borrar de una conversación abre el modal propio (no `window.confirm` nativo).
- **F-DEL-02**: "Cancelar" cierra el modal sin borrar nada.
- **F-DEL-03**: "Borrar" elimina la conversación de Postgres (cascada también borra sus `Message`) y actualiza el sidebar.
- **F-DEL-04**: borrar la conversación actualmente activa vuelve al estado vacío.
- **F-DEL-05**: Escape cierra el modal de borrado sin confirmar.
- **F-DEL-06**: (ver hallazgo #2 en sección 5) si el `DELETE` falla en el servidor, hoy la API igual responde `{ok:true}` — validar que un fallo real de Postgres no deje a la UI mostrando una conversación "borrada" que en realidad sigue en la base.

### F-SETTINGS — Configuración (prompt de sistema)
- **F-SETTINGS-01**: abrir el modal carga el contenido real de `SYSTEM_PROMPT.md` en el textarea.
- **F-SETTINGS-02**: editar el textarea habilita "Guardar" y muestra "Sin guardar"; guardar lo deshabilita de nuevo.
- **F-SETTINGS-03**: guardar escribe efectivamente el archivo `SYSTEM_PROMPT.md` en disco (verificable vía `GET /api/settings`).
- **F-SETTINGS-04**: una regla del prompt de sistema (ej. "siempre respondé con la palabra X") se refleja en la próxima respuesta del modelo — ya validado end-to-end.
- **F-SETTINGS-05**: cerrar y reabrir el modal sin guardar descarta los cambios del textarea (recarga desde el archivo).

### F-MEMORY — Memoria persistente
- **F-MEMORY-01**: agregar una nota la persiste en la tabla `Memory` y aparece en la lista.
- **F-MEMORY-02**: una nota de memoria se inyecta en el prompt de sistema de **cualquier** conversación (nueva o existente), no solo en la que estaba activa al crearla.
- **F-MEMORY-03**: borrar una nota la remueve de la UI y de Postgres (con espera suficiente — verificado, funciona pero es asíncrono).
- **F-MEMORY-04**: límite de 500 caracteres por nota y 100 notas totales se hacen respetar server-side (`POST /api/memory` con contenido más largo, o la nota #101, deben rechazarse con 400).
- **F-MEMORY-05**: (ver hallazgo #1 en sección 5) validar consumo de contexto cuando hay muchas notas de memoria + historial largo — posible degradación silenciosa de la calidad de respuesta.

### F-RESP — Responsive / accesibilidad
- **F-RESP-01**: en mobile (< 768px), sidebar arranca oculta; el botón hamburguesa la abre como overlay con backdrop.
- **F-RESP-02**: tocar el backdrop cierra la sidebar en mobile.
- **F-RESP-03**: navegación por teclado (Tab) llega a todos los controles interactivos con anillo de foco visible.
- **F-RESP-04**: `prefers-reduced-motion: reduce` neutraliza las animaciones (`msg-enter`, `think-dot`, `shimmer`, `animate-ping`).
- **F-RESP-05**: ambos modales atrapan el foco (Tab no se escapa) y devuelven el foco al trigger al cerrarse.

---

## 3. Plan de pruebas unitarias

**Estado actual: el proyecto no tiene ningún framework de testing configurado** (no hay Jest/Vitest/Testing Library en `package.json`). Antes de escribir tests unitarios hay que decidir e instalar uno (recomendado: **Vitest**, por velocidad y compatibilidad nativa con TypeScript/ESM, que es como está configurado el proyecto).

### Candidatos a testear en aislamiento (sin DB ni red)

| Módulo | Función | Casos a cubrir |
|---|---|---|
| `src/lib/ollama.ts` | `buildOllamaMessage` | texto solo, con adjuntos de texto (se anexan al `content`), con imágenes (van a `images`), mezcla de ambos, sin adjuntos (`attachments` undefined) |
| `src/lib/ollama.ts` | parser NDJSON interno de `streamOllamaChat` (`emitLine`, hoy no exportado — considerar exportarlo para poder testearlo aislado) | línea completa válida, línea vacía, última línea sin `\n` final, línea con JSON inválido (debe propagar error) |
| `src/lib/settings.ts` | `getSystemPrompt` / `setSystemPrompt` | archivo inexistente → devuelve default; archivo con contenido → lo devuelve trimeado; `setSystemPrompt` trunca a `MAX_SYSTEM_PROMPT_CHARS` |
| `src/app/api/chat/route.ts` | `parseAttachments` (hoy no exportada — exportar para testear) | array vacío/undefined, más de `MAX_ATTACHMENTS`, `kind` inválido, texto que excede `MAX_TEXT_CHARS`, imagen que excede `MAX_IMAGE_BASE64_CHARS` |
| `src/app/page.tsx` | `shortModel` | con sufijo `:cloud`, con sufijo `-cloud`, con `:latest`, sin sufijo |
| `src/app/page.tsx` | `isCloudModel` | positivo/negativo para ambos formatos de sufijo |

### Candidatos a testear con mocks (Prisma / fetch a Ollama mockeados)

| Endpoint | Casos |
|---|---|
| `POST /api/chat` | modelo no disponible → 400; conversación inexistente → 404; Ollama caído → 502 sin persistir mensaje huérfano; éxito → persiste user+assistant y actualiza `updatedAt`; primer mensaje → genera título |
| `POST /api/conversations` | modelo inválido → 400; modelo válido → crea con título default |
| `DELETE /api/conversations/[id]` | borra y cascada de mensajes; id inexistente no rompe (hoy silencia el error, ver hallazgo) |
| `GET/PUT /api/settings` | GET sin archivo → default; PUT persiste y trunca a `MAX_SYSTEM_PROMPT_CHARS` |
| `POST /api/memory` | contenido vacío → 400; > 500 chars → 400; #101 → 400; éxito → crea |
| `DELETE /api/memory/[id]` | borra; id inexistente no rompe |

### Candidatos a testear con Prisma real + DB de test (integración, no unitario puro)
- Flujo completo `POST /api/conversations` → `POST /api/chat` → `GET /api/conversations/[id]` y verificar consistencia de datos, ya cubierto manualmente con Playwright en esta sesión pero sin automatizar en CI.

---

## 4. Estado de dependencias (`npm outdated` + `npm view`)

| Paquete | Instalado | Última disponible | Tipo de salto | Recomendación |
|---|---|---|---|---|
| `next` | 16.2.12 | 16.2.12 | — | ya al día |
| `eslint-config-next` | 16.2.12 | 16.2.12 | — | ya al día |
| `react` / `react-dom` | 19.2.4 | 19.2.8 | patch | actualizar sin drama cuando se quiera |
| `@types/node` | 20.19.43 | 26.1.2 | **major** | NO actualizar a la ligera — Node 26 types puede no matchear el runtime real instalado; validar versión de Node del sistema primero |
| `typescript` | 5.9.3 | 7.0.2 | **major** (saltó la serie 6.x) | requiere revisión: TS 7 trae el nuevo compilador nativo (`tsgo`), cambios de comportamiento en checking; no actualizar sin correr toda la suite de tipos y probar el build |
| `prisma` / `@prisma/client` | 6.19.3 | 7.9.1 | **major** | Prisma 7 tiene cambios de configuración (ya se ve venir en `prisma.config.ts`, que es un mecanismo relativamente nuevo); requiere leer el changelog de breaking changes antes de tocarlo, especialmente por el generador `prisma-client` custom que ya se usa (`output: "../src/generated/prisma"`) |

**Ninguna actualización se aplicó** — quedan a decisión del usuario, todas son saltos de versión mayor salvo React (patch, bajo riesgo).

---

## 5. Auditoría de valores hardcodeados

Búsqueda de `localhost`, puertos, URLs y `process.env` en `src/`.

| Archivo:línea | Qué es | Severidad | Nota |
|---|---|---|---|
| `src/lib/ollama.ts:2` | `"http://localhost:11434"` | ✅ OK | es el **default** correcto de `getBaseUrl()`, se pisa con `OLLAMA_BASE_URL` — no es un hardcodeo problemático, es el fallback esperado |
| ~~`src/app/api/chat/route.ts:120`~~ | mensaje de error con `"localhost:11434"` fijo | 🔧 **corregido durante esta sesión** | ahora usa `getBaseUrl()` real en vez del string fijo |
| `src/app/page.tsx` (texto del header) | `"Servida desde tu Ollama en localhost — nada sale de tu máquina"` | ✅ OK | es copy visible al usuario, no configuración — correcto que sea texto fijo (con su variante para modelos cloud) |
| `docker-compose.yml` | usuario/contraseña de Postgres en texto plano (`chatuser`/`chatpass`) | 🟡 aceptable para dev local | son credenciales de un contenedor Docker local, no expuesto a internet; si se lleva a un entorno compartido, mover a variables de entorno del propio `docker-compose.yml` |
| Resto de `process.env.*` | `DATABASE_URL`, `OLLAMA_BASE_URL`, `OLLAMA_DEFAULT_MODEL`, `NODE_ENV` | ✅ OK | todo lo configurable pasa por `.env`, ningún secreto ni URL de producción hardcodeada en el código |

**Conclusión de la auditoría**: no hay secretos ni tokens hardcodeados en el código fuente. Es una app local de un solo usuario sin backend externo que requiera API keys propias (Ollama no usa autenticación en localhost). No aplica agregar "tokens de seguridad" tipo API key/session token porque no hay superficie que los necesite hoy — la recomendación de seguridad real y accionable es la de la sección 6.

---

## 6. Notas de seguridad (Next.js / `.env`)

- **CSRF**: las rutas mutantes (`POST/PUT/DELETE`) no tienen protección CSRF explícita. Para una app que corre exclusivamente en `localhost` y sin cookies de sesión (no hay auth), el riesgo real es bajo, pero si en algún momento se expone la app fuera de `localhost` (ej. detrás de un túnel o en una red compartida), esto pasa a ser relevante.
- **Rate limiting**: ningún endpoint tiene límite de requests. Irrelevante para un solo usuario local; relevante si se expone la app.
- **Cabeceras de seguridad** (CSP, `X-Frame-Options`, etc.): Next.js no las setea por defecto; hoy no están configuradas en `next.config.ts`. No urgente para uso 100% local.
- **`.env` / `.env.example`**: correctamente separados, `.env` está en `.gitignore` (confirmado en sesiones previas), `.env.example` no tiene secretos reales, solo placeholders de Postgres local.
- **Conclusión**: para el alcance actual (single-user, localhost, sin datos sensibles de terceros), no hay hallazgos de seguridad urgentes. Si el plan es exponer la app más allá de `localhost` en algún momento, ahí sí conviene planificar: autenticación básica, CSRF tokens, rate limiting y CSP — pero implementarlo ahora sería trabajo prematuro (YAGNI) para el uso actual.

---

## 7. Resumen de hallazgos de la revisión de código (para referencia — no corregidos automáticamente)

Detalle completo lo dio el agente de revisión en esta misma sesión; resumen accionable:

1. 🔴 **Contexto sin gestión de tamaño**: cada turno reenvía TODO el historial + adjuntos + memoria + prompt de sistema a Ollama, sin `num_ctx` fijado ni recorte — puede degradar respuestas silenciosamente en conversaciones largas con adjuntos. → cubierto por **F-MEMORY-05** arriba.
2. 🟡 **Errores de `DELETE` silenciados** (`.catch(() => null)`) en conversaciones y memoria — un fallo real de Postgres se reporta como éxito. → cubierto por **F-DEL-06**.
3. 🟡 `handleOpenSettings` pierde ambos resultados si una de las dos fetches paralelas falla en el `.json()`. → agregar caso de test específico si se decide automatizar.
4. 🟡 Adjuntos pendientes usan `name` como key/identidad — dos archivos con el mismo nombre colisionan. → cubierto por **F-ATTACH-08**.
5. 💭 Condición de carrera menor (TOCTOU) en el límite de 100 notas de memoria.
6. 💭 Inconsistencia cosmética de `.trim()` entre lectura y escritura del prompt de sistema.

---

## 8. Siguiente paso sugerido (no ejecutado)

1. Decidir framework de testing (recomendado Vitest) e instalarlo.
2. Implementar primero los tests unitarios de la sección 3 (sin DB) — son los más baratos y de mayor retorno inmediato.
3. Automatizar un subconjunto de los casos F-CHAT/F-ATTACH/F-DEL/F-SETTINGS/F-MEMORY como tests de integración con Playwright (ya hay scripts ad-hoc de esta sesión que pueden formalizarse en `tests/` dentro del repo).
4. Resolver los hallazgos 🔴/🟡 de la sección 7 antes de seguir agregando funcionalidades sobre memoria/adjuntos.

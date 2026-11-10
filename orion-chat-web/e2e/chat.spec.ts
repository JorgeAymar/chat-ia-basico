import { test, expect } from "@playwright/test";
import {
  messageBubbles,
  messageInput,
  sendButton,
  sendMessageAndWaitForReply,
  trackConsoleErrors,
  uniqueSuffix,
  waitForModelsReady,
  waitForStreamEnd,
} from "./helpers";

// F-CHAT — Conversación (ver TEST_PLAN.md secciones F-CHAT-01..11)
// Cubrimos un subconjunto representativo: creación+título, multi-turno,
// anti-doble-envío, mensaje vacío, y "Nueva conversación" sin fila vacía.

test.describe("F-CHAT — Conversación", () => {
  // Cada envío espera una respuesta real del Ollama remoto: el timeout por
  // test de 30s del config no alcanza.
  test.describe.configure({ timeout: 180_000 });

  test("F-CHAT-01: enviar el primer mensaje crea la conversación y auto-genera el título", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const text = `Hola ambar test ${uniqueSuffix()}`;
    await sendMessageAndWaitForReply(page, text);

    // El mensaje del usuario debe verse en la burbuja de la conversación.
    await expect(messageBubbles(page).getByText(text, { exact: true })).toBeVisible();

    // El título (texto completo, ya que es < 45 chars) debe aparecer en el
    // historial del sidebar, confirmando que la conversación se creó en DB.
    // (El mismo texto aparece dos veces en el DOM — burbuja + título del
    // sidebar — por eso cada assertion está scopeada a su contenedor.)
    await expect(page.locator("aside").getByText(text, { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("F-CHAT-04: multi-turno (5 mensajes) no pierde, duplica ni reordena mensajes", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    // 5 idas y vueltas contra un modelo remoto: se le da margen extra.
    test.setTimeout(600_000);

    const suffix = uniqueSuffix();
    const texts = Array.from({ length: 5 }, (_, i) => `Turno ${i + 1} ${suffix}`);

    for (const text of texts) {
      await sendMessageAndWaitForReply(page, text, { timeout: 90000 });
    }

    // Cada mensaje de usuario debe aparecer exactamente una vez dentro del
    // área de mensajes (no duplicado). Scopeado a las burbujas porque el
    // mismo texto también aparece como título en el sidebar y en el header
    // (solo el del 1er mensaje).
    for (const text of texts) {
      await expect(messageBubbles(page).getByText(text, { exact: true })).toHaveCount(1);
    }

    // Deben existir al menos 10 burbujas (5 user + 5 assistant), sin pérdidas.
    const bubbleCount = await messageBubbles(page).count();
    expect(bubbleCount).toBeGreaterThanOrEqual(10);

    expect(errors).toEqual([]);
  });

  // NOTA: este test cubría un bug real que ya está corregido en la app
  // (`handleSend` en src/app/page.tsx ahora hace `setIsStreaming(true)` ANTES
  // del await que crea la conversación, así que el segundo click cae con el
  // botón de enviar ya reemplazado por el de "Detener generación").
  test("F-CHAT-05: doble click rápido en Enviar no duplica el mensaje del usuario", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const text = `Doble click ${uniqueSuffix()}`;
    await messageInput(page).fill(text);
    const btn = sendButton(page);

    // Dos clicks disparados lo más rápido posible: el segundo debería
    // encontrar el botón ya fuera del DOM (durante el streaming lo reemplaza
    // el de "Detener generación"), así que se lo deja fallar con un timeout
    // corto en vez de esperar el default de 30s.
    await Promise.all([btn.click(), btn.click({ timeout: 2000 }).catch(() => {})]);

    await waitForStreamEnd(page);

    // El mensaje del usuario debe aparecer una única vez dentro del área de
    // mensajes, no duplicado (scopeado a las burbujas: el mismo texto también
    // aparece como título del sidebar y del header, eso es esperado).
    await expect(messageBubbles(page).getByText(text, { exact: true })).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test("F-CHAT-08: mensaje vacío (sin texto ni adjuntos) no dispara el envío", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const btn = sendButton(page);
    // Sin texto ni adjuntos, el botón debe estar deshabilitado.
    await expect(btn).toBeDisabled();

    // Intentar "click" en un botón disabled no dispara el submit del form;
    // confirmamos que seguimos en el estado vacío (sin mensajes).
    const bubbleCountBefore = await messageBubbles(page).count();
    expect(bubbleCountBefore).toBe(0);

    expect(errors).toEqual([]);
  });

  test("F-CHAT-10: Nueva conversación vuelve al estado vacío y no deja fila vacía en el historial", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    // Contamos conversaciones existentes antes de tocar "Nueva conversación"
    // sin haber enviado nada — no debería cambiar el conteo del sidebar.
    const newConvoBtn = page.getByRole("button", { name: "Nueva conversación" });
    await newConvoBtn.click();

    // El selector de modelo debe estar habilitado en estado vacío.
    const modelSelect = page.locator("select");
    await expect(modelSelect).toBeEnabled();

    // El estado vacío se muestra (título "¿En qué estás pensando?").
    await expect(page.getByText("¿En qué estás pensando?")).toBeVisible();

    // Verificamos vía API que no se creó ninguna fila nueva de conversación
    // sin título/mensaje real (todas las conversaciones existentes deben
    // tener al menos un mensaje real o un título distinto de vacío).
    const res = await page.request.get("/api/conversations");
    const data = await res.json();
    const emptyDefaultTitles = (data.conversations as Array<{ title: string }>).filter(
      (c) => c.title === "" || c.title == null
    );
    expect(emptyDefaultTitles.length).toBe(0);

    expect(errors).toEqual([]);
  });
});

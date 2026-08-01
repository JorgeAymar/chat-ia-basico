import { test, expect } from "@playwright/test";
import {
  messageInput,
  sendButton,
  sendMessageAndWaitForReply,
  trackConsoleErrors,
  uniqueSuffix,
  waitForModelsReady,
} from "./helpers";

// F-CHAT — Conversación (ver TEST_PLAN.md secciones F-CHAT-01..11)
// Cubrimos un subconjunto representativo: creación+título, multi-turno,
// anti-doble-envío, mensaje vacío, y "Nueva conversación" sin fila vacía.

test.describe("F-CHAT — Conversación", () => {
  test("F-CHAT-01: enviar el primer mensaje crea la conversación y auto-genera el título", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const text = `Hola ambar test ${uniqueSuffix()}`;
    await sendMessageAndWaitForReply(page, text);

    // El mensaje del usuario debe verse en la burbuja de la conversación.
    await expect(page.locator("main").getByText(text, { exact: true })).toBeVisible();

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

    const suffix = uniqueSuffix();
    const texts = Array.from({ length: 5 }, (_, i) => `Turno ${i + 1} ${suffix}`);

    for (const text of texts) {
      await sendMessageAndWaitForReply(page, text, { timeout: 90000 });
    }

    // Cada mensaje de usuario debe aparecer exactamente una vez dentro del
    // área de mensajes (no duplicado). Scopeado a `main` porque el mismo
    // texto también aparece como título en el sidebar (solo el 1er mensaje).
    for (const text of texts) {
      await expect(page.locator("main").getByText(text, { exact: true })).toHaveCount(1);
    }

    // Deben existir al menos 10 burbujas (5 user + 5 assistant), sin pérdidas.
    const bubbleCount = await page.locator("main .msg-enter").count();
    expect(bubbleCount).toBeGreaterThanOrEqual(10);

    expect(errors).toEqual([]);
  });

  // HALLAZGO (bug real de la app, NO corregido acá por consigna — ver
  // src/app/page.tsx `handleSend`): este test falla de forma reproducible.
  // Un doble click rápido en "Enviar" crea DOS conversaciones separadas,
  // cada una con el mismo primer mensaje, en vez de bloquear el segundo
  // envío. Causa raíz: `handleSend` solo revisa `isStreaming` al entrar,
  // pero `setIsStreaming(true)` se llama recién DESPUÉS del `await fetch(
  // "/api/conversations", ...)` que crea la conversación cuando no hay
  // `activeId` todavía. Durante esa ventana async, el botón de enviar
  // sigue habilitado (isStreaming sigue en false y el input todavía tiene
  // texto), así que un segundo click que caiga en esa ventana vuelve a
  // entrar a `handleSend`, ve `activeId` (todavía null en el closure de ese
  // render) y crea una segunda conversación con el mismo mensaje. Fix
  // sugerido: mover `setIsStreaming(true)` (o un guard equivalente, ej. un
  // ref) al principio de `handleSend`, antes del primer `await`.
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
    // encontrar el botón ya deshabilitado (anti doble-envío). Un botón
    // <button disabled> no dispara el evento click en el navegador, así que
    // si la app no se deshabilita a tiempo, este test lo va a detectar como
    // un mensaje duplicado más abajo.
    await Promise.all([btn.click(), btn.click().catch(() => {})]);

    // Esperar a que termine el streaming (reaparece el ícono de flecha).
    await expect(btn.locator("svg")).toBeVisible({ timeout: 90000 });

    // El mensaje del usuario debe aparecer una única vez dentro del área de
    // mensajes, no duplicado (scopeado a `main`: el mismo texto también
    // aparece una vez más como título en el sidebar, eso es esperado).
    await expect(page.locator("main").getByText(text, { exact: true })).toHaveCount(1);

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
    const bubbleCountBefore = await page.locator("main .msg-enter").count();
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

    // El estado vacío se muestra (placeholder "¿En qué piensas?").
    await expect(page.getByText("¿En qué piensas?")).toBeVisible();

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

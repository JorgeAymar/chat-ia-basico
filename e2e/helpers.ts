import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Helpers compartidos por los specs E2E de Orion Chat.
 * Nada acá está hardcodeado a un valor de negocio: todo lo que identifica un
 * mensaje/conversación/nota de memoria en un test se genera con un sufijo
 * único (timestamp + random) para poder correr los tests en paralelo o en
 * corridas repetidas contra la misma base Postgres persistente sin chocar.
 */

/** Sufijo corto y único para no colisionar entre corridas de test. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Engancha el listener de errores de consola y devuelve el array donde se acumulan. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

/** Espera a que el selector de modelos tenga al menos una opción real (app "ready"). */
export async function waitForModelsReady(page: Page) {
  const select = page.locator("select");
  // Con `models` vacío el Composer renderiza una única opción placeholder
  // ("Sin modelos instalados en Ollama"): que la primera opción NO sea esa
  // es la señal de que /api/models ya respondió con modelos reales.
  await expect(select.locator("option").first()).not.toHaveText(/Sin modelos/, {
    timeout: 15000,
  });
}

/** Botón de enviar mensaje, identificado por su aria-label (no hardcodeado a texto de negocio). */
export function sendButton(page: Page) {
  return page.getByRole("button", { name: "Enviar mensaje" });
}

/** Botón que corta el streaming; solo existe mientras la respuesta se genera. */
export function stopButton(page: Page) {
  return page.getByRole("button", { name: "Detener generación" });
}

/** Campo de texto del composer (hoy un <textarea>: Enter envía, Shift+Enter salta línea). */
export function messageInput(page: Page) {
  return page.getByPlaceholder("Escribí tu mensaje…");
}

/**
 * Burbujas de mensaje del hilo activo. Se scopea acá y no a `main` a secas
 * porque el header también muestra el título de la conversación, que es el
 * texto del primer mensaje: buscar por texto en `main` matchea las dos cosas.
 */
export function messageBubbles(page: Page) {
  return page.locator("main .msg-enter");
}

/**
 * Espera a que termine el streaming de una respuesta usando el estado de la
 * UI (no el contenido, que depende del modelo remoto): mientras genera, el
 * botón de enviar es reemplazado por el de "Detener generación"; cuando
 * termina, vuelve el de enviar.
 */
export async function waitForStreamEnd(page: Page, opts: { timeout?: number } = {}) {
  const stop = stopButton(page);
  // Si la respuesta es muy corta el botón de detener puede aparecer y
  // desaparecer entre dos polls, así que no se falla por no haberlo visto:
  // la condición que importa es la de abajo (ya no hay streaming activo).
  await stop.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await expect(stop).toHaveCount(0, { timeout: opts.timeout ?? 120000 });
  await expect(sendButton(page)).toBeVisible();
}

/**
 * Escribe un mensaje y lo envía, esperando a que termine el streaming antes
 * de continuar. Usa el estado de la UI como señal, no un timeout fijo.
 */
export async function sendMessageAndWaitForReply(
  page: Page,
  text: string,
  opts: { timeout?: number } = {}
) {
  await messageInput(page).fill(text);
  await sendButton(page).click();
  await waitForStreamEnd(page, opts);
}

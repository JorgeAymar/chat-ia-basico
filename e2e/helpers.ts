import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Helpers compartidos por los specs E2E de Ámbar.
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
  await expect(select.locator("option").first()).not.toHaveText("Sin modelos en .env", {
    timeout: 15000,
  });
}

/** Botón de enviar mensaje, identificado por su aria-label (no hardcodeado a texto de negocio). */
export function sendButton(page: Page) {
  return page.getByRole("button", { name: "Enviar mensaje" });
}

/** Input de texto del composer, identificado por su placeholder cuando la app está lista. */
export function messageInput(page: Page) {
  return page.getByPlaceholder("Escribe tu mensaje…");
}

/**
 * Escribe un mensaje y lo envía, esperando a que termine el streaming
 * (el botón de enviar vuelve a estar disponible) antes de continuar.
 * Usa el propio estado del botón como señal, no un timeout fijo.
 */
export async function sendMessageAndWaitForReply(
  page: Page,
  text: string,
  opts: { timeout?: number } = {}
) {
  const input = messageInput(page);
  await input.fill(text);
  const btn = sendButton(page);
  await btn.click();
  // Mientras streamea, el botón muestra un punto pulsante (think-dot) en vez
  // del ícono de flecha (ver page.tsx: `isStreaming ? <span think-dot> : <svg>`).
  // Como el input se vacía apenas se envía, el botón NO vuelve a habilitarse
  // (sigue disabled por "sin texto"), así que la señal de "terminó de
  // streamear" es que reaparezca el ícono de flecha (svg), no que se habilite.
  await expect(btn.locator(".think-dot")).toBeVisible({ timeout: 5000 });
  await expect(btn.locator("svg")).toBeVisible({ timeout: opts.timeout ?? 90000 });
}

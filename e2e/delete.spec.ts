import { test, expect } from "@playwright/test";
import {
  sendMessageAndWaitForReply,
  trackConsoleErrors,
  uniqueSuffix,
  waitForModelsReady,
} from "./helpers";

// F-DEL — Borrado de conversaciones (TEST_PLAN.md F-DEL-01..06)
//
// Los botones "Cancelar"/"Borrar" del modal se ubican SIEMPRE a través del
// locator del propio `alertdialog` (nunca `page.getByRole` a secas): como
// el texto de la conversación de prueba también aparece en el sidebar
// (dentro del aria-label del botón "Borrar \"...\""), buscar por nombre en
// toda la página puede matchear más de un elemento.

async function createConversation(page: import("@playwright/test").Page, label: string) {
  await page.goto("/");
  await waitForModelsReady(page);
  const text = `${label} ${uniqueSuffix()}`;
  await sendMessageAndWaitForReply(page, text);
  return text;
}

test.describe("F-DEL — Borrado de conversaciones", () => {
  test("F-DEL-01: el modal de borrado es propio de la app (role=alertdialog), no window.confirm", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    let nativeDialogFired = false;
    page.on("dialog", (dialog) => {
      nativeDialogFired = true;
      dialog.dismiss().catch(() => {});
    });

    const title = await createConversation(page, "E2E delete alertdialog");

    const deleteTrigger = page.getByRole("button", { name: `Borrar "${title}"`, exact: true });
    await deleteTrigger.click();

    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();

    // Confirmamos que NUNCA se disparó un window.confirm/alert/prompt nativo.
    expect(nativeDialogFired).toBe(false);

    // Cerramos sin borrar para no interferir con el resto del test.
    await modal.getByRole("button", { name: "Cancelar" }).click();

    expect(errors).toEqual([]);
  });

  test("F-DEL-02: Cancelar cierra el modal sin borrar", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const title = await createConversation(page, "E2E delete cancelar");

    const deleteTrigger = page.getByRole("button", { name: `Borrar "${title}"`, exact: true });
    await deleteTrigger.click();
    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // La conversación sigue en el sidebar.
    await expect(page.locator("aside").getByText(title, { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("F-DEL-03/04: Borrar elimina la conversación, actualiza el sidebar y vuelve al estado vacío si estaba activa", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const title = await createConversation(page, "E2E delete confirmar");

    const deleteTrigger = page.getByRole("button", { name: `Borrar "${title}"`, exact: true });
    await deleteTrigger.click();
    const modal = page.getByRole("alertdialog");
    await modal.getByRole("button", { name: "Borrar", exact: true }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    // Ya no debe estar en el sidebar (usamos auto-retry de expect, no timeout fijo).
    await expect(page.locator("aside").getByText(title, { exact: true })).toHaveCount(0);

    // Como era la conversación activa, la vista vuelve al estado vacío.
    await expect(page.getByText("¿En qué piensas?")).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("F-DEL-05: Escape cierra el modal de borrado sin confirmar", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const title = await createConversation(page, "E2E delete escape");

    const deleteTrigger = page.getByRole("button", { name: `Borrar "${title}"`, exact: true });
    await deleteTrigger.click();
    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.locator("aside").getByText(title, { exact: true })).toBeVisible();

    // Limpieza: borramos la conversación de prueba para no acumular basura.
    await page.getByRole("button", { name: `Borrar "${title}"`, exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Borrar", exact: true }).click();

    expect(errors).toEqual([]);
  });
});

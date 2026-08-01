import { test, expect } from "@playwright/test";
import { trackConsoleErrors, uniqueSuffix } from "./helpers";

// F-SETTINGS — Configuración (prompt de sistema) (TEST_PLAN.md F-SETTINGS-01..05)

test.describe("F-SETTINGS — Configuración", () => {
  test("F-SETTINGS-01: abrir el modal carga el contenido real de SYSTEM_PROMPT.md", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Configuración" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const textarea = page.locator("#system-prompt");
    await expect(textarea).toBeVisible();

    // Comparamos contra lo que devuelve el propio endpoint (fuente de verdad),
    // sin hardcodear el contenido del prompt en el test.
    const res = await page.request.get("/api/settings");
    const data = await res.json();
    await expect(textarea).toHaveValue(data.systemPrompt ?? "");
    expect((data.systemPrompt ?? "").length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Cerrar" }).click();

    expect(errors).toEqual([]);
  });

  test("F-SETTINGS-02: editar habilita Guardar; guardar lo deshabilita de nuevo", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración" }).click();

    const textarea = page.locator("#system-prompt");
    await expect(textarea).toBeVisible();
    const original = await textarea.inputValue();

    const saveBtn = page.getByRole("button", { name: /^Guardar$/ });
    await expect(saveBtn).toBeDisabled();

    // Editamos agregando un sufijo único y luego lo revertimos al final del
    // test para no dejar el prompt del sistema real modificado.
    const edited = `${original}\n<!-- e2e ${uniqueSuffix()} -->`;
    await textarea.fill(edited);

    await expect(page.getByText("Sin guardar")).toBeVisible();
    await expect(saveBtn).toBeEnabled();

    await saveBtn.click();
    await expect(saveBtn).toBeDisabled();
    await expect(page.getByText("Sin guardar")).toHaveCount(0);

    // Revertimos al contenido original vía API para dejar el estado limpio.
    await page.request.put("/api/settings", {
      data: { systemPrompt: original },
    });

    expect(errors).toEqual([]);
  });

  test("F-SETTINGS-05: Escape cierra el modal", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});

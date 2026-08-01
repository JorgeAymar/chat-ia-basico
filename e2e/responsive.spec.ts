import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./helpers";

// F-RESP — Responsive / accesibilidad (TEST_PLAN.md F-RESP-01/02, subset mobile)

test.describe("F-RESP — Responsive (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("F-RESP-01: en mobile la sidebar arranca oculta y el botón hamburguesa la muestra como overlay", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");

    const sidebar = page.locator("aside");
    // Oculta: trasladada fuera de pantalla (-translate-x-full), sin backdrop visible.
    await expect(sidebar).toHaveClass(/-translate-x-full/);

    const hamburger = page.getByRole("button", { name: "Abrir historial de conversaciones" });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    await expect(sidebar).toHaveClass(/translate-x-0/);
    await expect(sidebar).not.toHaveClass(/-translate-x-full/);

    expect(errors).toEqual([]);
  });

  test("F-RESP-02: tocar el backdrop cierra la sidebar en mobile", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");

    const sidebar = page.locator("aside");
    await page.getByRole("button", { name: "Abrir historial de conversaciones" }).click();
    await expect(sidebar).toHaveClass(/translate-x-0/);

    // El backdrop es el div fixed inset-0 con aria-hidden="true" que cubre
    // toda la pantalla (scopeado por clase: hay otro div aria-hidden ajeno
    // al layout, un elemento decorativo de fondo, que no nos interesa).
    const backdrop = page.locator('div.fixed.inset-0[aria-hidden="true"]');
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: 350, y: 20 } });

    await expect(sidebar).toHaveClass(/-translate-x-full/);

    expect(errors).toEqual([]);
  });
});

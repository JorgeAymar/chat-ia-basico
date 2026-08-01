import { test, expect } from "@playwright/test";
import { trackConsoleErrors, waitForModelsReady } from "./helpers";

// F-MODEL — Selección y detección de modelos (TEST_PLAN.md F-MODEL-01..04)

test.describe("F-MODEL — Selección y detección de modelos", () => {
  test("F-MODEL-01: el dropdown de modelos tiene opciones (no vacío)", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const options = page.locator("select option");
    const count = await options.count();
    expect(count).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("F-MODEL-02: un modelo -cloud se distingue visualmente en el dropdown", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    // Leemos los modelos reales desde la propia API (sin hardcodear nombres
    // de modelo en el test) y verificamos la relación entre sufijo y marca
    // visual. NOTA: al momento de escribir este test la app marca los
    // modelos cloud agregando el texto "(cloud)" a la opción (antes usaba
    // el ícono ☁); el regex cubre ambas variantes para no ser frágil ante
    // un cambio de estilo que no cambie el comportamiento.
    const res = await page.request.get("/api/models");
    const data = await res.json();
    const models: string[] = data.models ?? [];
    const cloudModel = models.find((m) => /[:-]cloud$/.test(m));
    const nonCloudModel = models.find((m) => !/[:-]cloud$/.test(m));

    test.skip(!cloudModel, "No hay ningún modelo -cloud disponible en esta instancia de Ollama");

    const optionTexts = await page.locator("select option").allTextContents();
    const cloudMarked = optionTexts.filter((t) => /☁|\(cloud\)/i.test(t));
    expect(cloudMarked.length).toBeGreaterThan(0);

    // Si también hay un modelo no-cloud, confirmamos que ESE no lleva la marca.
    if (nonCloudModel) {
      const nonCloudMarked = optionTexts.filter(
        (t) => !/☁|\(cloud\)/i.test(t) && t.trim().length > 0
      );
      expect(nonCloudMarked.length).toBeGreaterThan(0);
    }

    expect(errors).toEqual([]);
  });

  test("F-MODEL-03: el indicador de estado de Ollama está en verde cuando source=ollama", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const res = await page.request.get("/api/models");
    const data = await res.json();

    test.skip(data.source !== "ollama", "Ollama no está reportando source=ollama en este entorno");

    // El punto de estado debe tener el color verde (emerald) cuando
    // ollamaOnline === true. Lo ubicamos por su `title` (estable ante
    // cambios de estructura/markup) en vez de por clases CSS puntuales.
    const statusDot = page.locator('aside [title="Ollama conectado"]');
    await expect(statusDot).toHaveClass(/bg-emerald-\d+/, { timeout: 10000 });

    // El badge de texto debe decir "local", no "sin conexión".
    await expect(page.getByText("local", { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  });
});

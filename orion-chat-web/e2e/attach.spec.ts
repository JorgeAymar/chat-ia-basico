import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  messageInput,
  sendButton,
  trackConsoleErrors,
  uniqueSuffix,
  waitForModelsReady,
  waitForStreamEnd,
} from "./helpers";

const TXT_FIXTURE = path.join(__dirname, "fixtures", "test-doc.txt");
const IMG_FIXTURE = path.join(__dirname, "fixtures", "test-image.png");
const MARKER = "AMBAR-7X92"; // debe coincidir con e2e/fixtures/test-doc.txt

// F-ATTACH — Adjuntos (TEST_PLAN.md F-ATTACH-01..09)

test.describe("F-ATTACH — Adjuntos", () => {
  // Estos tests esperan respuestas reales del Ollama remoto: el timeout por
  // test de 30s del config no alcanza.
  test.describe.configure({ timeout: 180_000 });

  test("F-ATTACH-02: el modelo lee el contenido del .txt adjunto y responde con el identificador que contiene", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TXT_FIXTURE);

    // El chip con el nombre del archivo debe aparecer antes de enviar (F-ATTACH-01).
    await expect(page.getByText("test-doc.txt")).toBeVisible();

    // Se pide el identificador de forma explícita y neutra: pedir "copiá el
    // código secreto" (o un documento que diga "no compartas esto") dispara
    // rechazos por falso positivo de alineación en los modelos cloud, aunque
    // el adjunto se haya leído perfecto. Si el contenido del archivo no
    // llegara al modelo, este no podría responder el identificador.
    const text = `¿Qué identificador aparece en el archivo de texto que adjunté? Respondé solo con ese identificador. ${uniqueSuffix()}`;
    await messageInput(page).fill(text);
    await sendButton(page).click();

    await waitForStreamEnd(page);

    // La respuesta del asistente debe contener el código leído del archivo:
    // esto valida que el contenido se lee de verdad, no que el archivo "se ve"
    // nomás. Se usa toContainText sobre `main` porque la respuesta se renderiza
    // como Markdown y el código puede quedar dentro de un <code>/<strong>.
    await expect(page.locator("main")).toContainText(MARKER, { timeout: 5000 });

    expect(errors).toEqual([]);
  });

  test("F-ATTACH-07/09: adjuntar una imagen muestra thumbnail antes y después de enviar; quitar adjunto pendiente funciona", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    // Usamos un modelo con soporte de visión si está disponible (kimi-k2.6:cloud
    // según TEST_PLAN.md); si no está, igual probamos el thumbnail/quitar
    // adjunto (que no dependen de la capacidad del modelo).
    const res = await page.request.get("/api/models");
    const data = await res.json();
    const models: string[] = data.models ?? [];
    const visionModel = models.find((m) => m.includes("kimi-k2.6"));
    if (visionModel) {
      await page.locator("select").selectOption(visionModel);
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(IMG_FIXTURE);

    // Thumbnail antes de enviar (en el chip del composer).
    const pendingThumb = page.locator("form img").first();
    await expect(pendingThumb).toBeVisible();

    // --- F-ATTACH-07: quitar el adjunto pendiente con "×" ---
    const removeBtn = page.getByRole("button", { name: "Quitar test-image.png" });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();
    await expect(pendingThumb).toHaveCount(0);

    // Volvemos a adjuntar para probar el envío real (F-ATTACH-09).
    await fileInput.setInputFiles(IMG_FIXTURE);
    await expect(page.locator("form img").first()).toBeVisible();

    const text = `Describe brevemente la imagen adjunta ${uniqueSuffix()}`;
    await messageInput(page).fill(text);
    await sendButton(page).click();
    await waitForStreamEnd(page);

    // Thumbnail después de enviar, ya dentro de la burbuja del usuario.
    await expect(page.locator("main img").first()).toBeVisible();

    // Si el modelo no soporta visión, la app debe mostrar el banner de error
    // (⚠) en vez de colgarse; en ese caso no hay error de consola tampoco,
    // porque la app maneja el fallo con un `catch` y estado de error, no con
    // un throw sin manejar. Por eso esta assertion vale en ambos casos.
    expect(errors).toEqual([]);
  });
});

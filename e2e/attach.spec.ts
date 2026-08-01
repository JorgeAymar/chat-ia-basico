import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  messageInput,
  sendButton,
  trackConsoleErrors,
  uniqueSuffix,
  waitForModelsReady,
} from "./helpers";

const TXT_FIXTURE = path.join(__dirname, "fixtures", "test-doc.txt");
const IMG_FIXTURE = path.join(__dirname, "fixtures", "test-image.png");
const SECRET_CODE = "AMBAR-7X92"; // debe coincidir con e2e/fixtures/test-doc.txt

// F-ATTACH — Adjuntos (TEST_PLAN.md F-ATTACH-01..09)

test.describe("F-ATTACH — Adjuntos", () => {
  test("F-ATTACH-02: el modelo lee el contenido del .txt adjunto y responde con el código secreto", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TXT_FIXTURE);

    // El chip con el nombre del archivo debe aparecer antes de enviar (F-ATTACH-01).
    await expect(page.getByText("test-doc.txt")).toBeVisible();

    // Pedimos que copie el contenido textual (no que "revele un secreto"):
    // algunos modelos rechazan preguntas frasedas como "¿cuál es el código
    // secreto?" por un falso positivo de alineación/seguridad, aun cuando
    // el archivo se leyó correctamente. Pedir una transcripción literal es
    // una tarea benigna que igual prueba que el contenido del adjunto llega
    // al modelo (si no llegara, no podría transcribirlo).
    const text = `Copia textualmente, línea por línea, todo el contenido del archivo de texto que adjunté. ${uniqueSuffix()}`;
    await messageInput(page).fill(text);
    const btn = sendButton(page);
    await btn.click();

    await expect(btn.locator(".think-dot")).toBeVisible({ timeout: 5000 });
    await expect(btn.locator("svg")).toBeVisible({ timeout: 120000 });

    // La respuesta del asistente debe contener el código leído del archivo:
    // esto valida que el contenido se lee de verdad, no que el archivo "se ve" nomás.
    await expect(page.locator("main").getByText(SECRET_CODE)).toBeVisible({ timeout: 5000 });

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
    const btn = sendButton(page);
    await btn.click();
    await expect(btn.locator(".think-dot")).toBeVisible({ timeout: 5000 });
    await expect(btn.locator("svg")).toBeVisible({ timeout: 120000 });

    // Thumbnail después de enviar, ya dentro de la burbuja del usuario.
    await expect(page.locator("main img").first()).toBeVisible();

    // Si el modelo no soporta visión, la app debe mostrar el banner de error
    // (⚠) en vez de colgarse; en ese caso no hay error de consola tampoco,
    // porque la app maneja el fallo con un `catch` y estado de error, no con
    // un throw sin manejar. Por eso esta assertion vale en ambos casos.
    expect(errors).toEqual([]);
  });
});

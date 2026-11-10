import { test, expect } from "@playwright/test";
import { trackConsoleErrors, waitForModelsReady } from "./helpers";

// Validación de formularios / tipos de dato (ver instrucciones del encargo).
//
// El input de mensaje es texto libre sin validación de formato estricta:
// lo único que valida es "no vacío" (ver F-CHAT-08 en chat.spec.ts). Acá
// cubrimos las validaciones de tipo/formato que sí existen: el atributo
// `accept` del input de archivo, y dejamos documentado (sin arreglarlo,
// según el encargo) que el prompt de sistema y la nota de memoria NO tienen
// `maxlength` en el DOM aunque el backend sí valida longitud.

test.describe("Validación de formularios / tipos de dato", () => {
  test("el <input type=file> respeta su atributo accept (whitelist de tipos)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await waitForModelsReady(page);

    const fileInput = page.locator('input[type="file"]');
    const accept = await fileInput.getAttribute("accept");
    expect(accept).not.toBeNull();

    const expectedTypes = [
      "image/*",
      "text/*",
      ".md",
      ".json",
      ".csv",
      ".log",
      ".js",
      ".ts",
      ".tsx",
      ".jsx",
      ".py",
      ".go",
      ".rb",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".css",
      ".html",
      ".yml",
      ".yaml",
    ];
    for (const type of expectedTypes) {
      expect(accept).toContain(type);
    }

    // multiple debe estar presente (varios adjuntos por mensaje).
    expect(await fileInput.getAttribute("multiple")).not.toBeNull();

    // NOTA: Playwright (y los navegadores en general) NO bloquean
    // `setInputFiles` con un tipo fuera de `accept` — el atributo `accept`
    // es solo una sugerencia de UI para el selector nativo del SO. Por eso
    // no intentamos "subir un archivo no permitido" acá: la validación real
    // de tamaño/tipo pasa en el cliente (handleFilesSelected en page.tsx) y
    // en el servidor (parseAttachments en api/chat/route.ts), no en el DOM.
    expect(errors).toEqual([]);
  });

  test("el textarea de prompt de sistema NO tiene maxlength en el DOM (el límite es server-side)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración" }).click();

    const textarea = page.locator("#system-prompt");
    await expect(textarea).toBeVisible();
    const maxLength = await textarea.getAttribute("maxlength");

    // HALLAZGO (informativo, no se corrige acá): no hay `maxlength` en el
    // DOM. El backend SÍ trunca a MAX_SYSTEM_PROMPT_CHARS = 20_000
    // (ver src/lib/settings.ts, setSystemPrompt), pero un usuario puede
    // pegar/escribir de forma ilimitada en el textarea sin feedback visual
    // hasta que guarda y el archivo queda truncado silenciosamente.
    expect(maxLength).toBeNull();

    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });

  test("el input de nueva nota de memoria NO tiene maxlength en el DOM (el límite es server-side)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración" }).click();

    const memoryInput = page.locator("#new-memory");
    await expect(memoryInput).toBeVisible();
    const maxLength = await memoryInput.getAttribute("maxlength");

    // HALLAZGO (informativo, no se corrige acá): tampoco hay `maxlength`
    // acá. El backend SÍ rechaza con 400 contenido > MAX_MEMORY_CHARS = 500
    // (ver src/app/api/memory/route.ts, cubierto en F-MEMORY-04 de
    // memory.spec.ts), pero el usuario no tiene feedback en el momento de
    // escribir — solo se entera al hacer submit y recibir el error.
    expect(maxLength).toBeNull();

    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
});

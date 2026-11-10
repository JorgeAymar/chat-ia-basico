import { test, expect } from "@playwright/test";
import { trackConsoleErrors, uniqueSuffix } from "./helpers";

// F-MEMORY — Memoria persistente (TEST_PLAN.md F-MEMORY-01..04)

test.describe("F-MEMORY — Memoria persistente", () => {
  test("F-MEMORY-01/03: agregar una nota la persiste y aparece; borrarla la remueve", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Configuración" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const content = `Nota de prueba e2e ${uniqueSuffix()}`;
    const memoryInput = page.locator("#new-memory");
    await memoryInput.fill(content);
    await page.getByRole("button", { name: "Agregar" }).click();

    const noteItem = page.getByText(content, { exact: true });
    await expect(noteItem).toBeVisible();
    await expect(memoryInput).toHaveValue("");

    // Borrar: usamos expect(...).toHaveCount(0) con su auto-retry (NO un
    // waitForTimeout fijo), ya que el borrado en la app es asíncrono
    // (actualiza el estado local antes de que resuelva el DELETE).
    const deleteBtn = page.getByRole("button", { name: `Borrar nota "${content}"` });
    await deleteBtn.click();
    await expect(page.getByText(content, { exact: true })).toHaveCount(0);

    // Confirmamos también contra la API que quedó borrada en Postgres. El
    // DELETE se dispara sin `await` desde el onClick de la app (fire-and-
    // forget: el estado local se actualiza antes de que resuelva el
    // fetch), así que usamos expect.poll en vez de una única lectura para
    // no generar una falla ruidosa por una carrera con el propio backend.
    await expect
      .poll(
        async () => {
          const res = await page.request.get("/api/memory");
          const data = await res.json();
          return (data.memories as Array<{ content: string }>).some(
            (m) => m.content === content
          );
        },
        { timeout: 10000 }
      )
      .toBe(false);

    expect(errors).toEqual([]);
  });

  test("F-MEMORY-04: límite de 500 caracteres por nota se respeta server-side (POST /api/memory)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/");

    const tooLong = `${uniqueSuffix()}-`.repeat(40); // > 500 chars garantizado
    expect(tooLong.length).toBeGreaterThan(500);

    const res = await page.request.post("/api/memory", {
      data: { content: tooLong },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("500");

    expect(errors).toEqual([]);
  });
});

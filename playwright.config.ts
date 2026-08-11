import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./e2e/global-setup";

// El servidor de la app (`npm run dev`) y Postgres (docker-compose, puerto 5436)
// ya deben estar corriendo ANTES de correr esta suite. La URL base sale de
// E2E_BASE_URL y por defecto apunta a http://localhost:3001 (el 3000 suele
// estar ocupado por otro proyecto en esta máquina).
// Deliberadamente NO configuramos `webServer` acá: el server es persistente
// (levantado fuera de esta suite) y no queremos que Playwright intente
// levantar/matar su propia instancia.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  // Loguea al owner una sola vez (ver e2e/global-setup.ts) y reusa esa
  // sesión en todos los tests: la app ahora exige login en cada request.
  globalSetup: "./e2e/global-setup",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    storageState: STORAGE_STATE_PATH,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

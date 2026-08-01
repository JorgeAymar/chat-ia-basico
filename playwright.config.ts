import { defineConfig, devices } from "@playwright/test";

// El servidor de la app (`npm run dev`) y Postgres (docker-compose, puerto 5435)
// ya deben estar corriendo en http://localhost:3000 ANTES de correr esta suite.
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
  use: {
    baseURL: "http://localhost:3000",
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

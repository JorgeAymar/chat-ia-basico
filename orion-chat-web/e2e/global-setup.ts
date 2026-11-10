// Playwright corre este archivo en su propio proceso Node, sin el
// autocargado de .env que tiene la app (Next.js) o Prisma: sin esto,
// OWNER_EMAIL llega undefined aunque esté bien puesto en .env.
import "dotenv/config";
import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Corre una sola vez, antes de toda la suite: le pone al owner una
// contraseña conocida (vía la puerta trasera de dev en
// POST /api/auth/dev/bootstrap-owner, que no existe en producción) y
// guarda la sesión resultante en un storageState que Playwright vuelve a
// cargar en cada test (ver `use.storageState` en playwright.config.ts).
// Sin esto, cada `page.goto("/")` de la suite rebotaría a /login.
const STORAGE_STATE_PATH = path.join(__dirname, ".auth", "owner.json");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3001";
// Solo se usa acá adentro, nunca en producción (la ruta de bootstrap 404
// fuera de desarrollo): no hace falta que sea un secreto real.
const TEST_PASSWORD = "orion-e2e-test-password-1234";

export default async function globalSetup() {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    throw new Error(
      "Falta OWNER_EMAIL en el entorno: hace falta para loguear al owner antes de correr los tests E2E."
    );
  }

  const context = await request.newContext({ baseURL: BASE_URL });
  try {
    const bootstrapRes = await context.post("/api/auth/dev/bootstrap-owner", {
      data: { password: TEST_PASSWORD },
    });
    if (!bootstrapRes.ok()) {
      throw new Error(
        `POST /api/auth/dev/bootstrap-owner devolvió ${bootstrapRes.status()}. ` +
          "¿El server contra el que corren los tests está en modo desarrollo (`npm run dev`)?"
      );
    }

    const loginRes = await context.post("/api/auth/login", {
      data: { email: ownerEmail, password: TEST_PASSWORD },
    });
    if (!loginRes.ok()) {
      throw new Error(`No se pudo loguear al owner para los tests E2E: ${await loginRes.text()}`);
    }

    fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
    await context.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await context.dispose();
  }
}

export { STORAGE_STATE_PATH };

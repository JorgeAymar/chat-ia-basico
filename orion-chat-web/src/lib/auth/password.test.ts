import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("una contraseña correcta verifica contra su propio hash", async () => {
    const hash = await hashPassword("mi-contraseña-segura");
    expect(await verifyPassword("mi-contraseña-segura", hash)).toBe(true);
  });

  it("una contraseña incorrecta no verifica", async () => {
    const hash = await hashPassword("mi-contraseña-segura");
    expect(await verifyPassword("otra-cosa", hash)).toBe(false);
  });

  it("el hash nunca contiene la contraseña en texto plano", async () => {
    const hash = await hashPassword("mi-contraseña-segura");
    expect(hash).not.toContain("mi-contraseña-segura");
  });

  it("dos hashes de la misma contraseña son distintos (salt aleatorio)", async () => {
    const a = await hashPassword("repetida");
    const b = await hashPassword("repetida");
    expect(a).not.toBe(b);
    // Pero ambos siguen verificando la contraseña original.
    expect(await verifyPassword("repetida", a)).toBe(true);
    expect(await verifyPassword("repetida", b)).toBe(true);
  });

  it("un hash guardado con formato roto (sin ':') no verifica ni explota", async () => {
    expect(await verifyPassword("cualquiera", "esto-no-tiene-el-formato-salt-hash")).toBe(false);
  });

  it("un hash vacío no verifica ni explota", async () => {
    expect(await verifyPassword("cualquiera", "")).toBe(false);
  });

  it("MIN_PASSWORD_LENGTH es razonable (ni trivial ni desproporcionado)", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
    expect(MIN_PASSWORD_LENGTH).toBeLessThanOrEqual(16);
  });
});

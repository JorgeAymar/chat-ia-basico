// createSession/deleteSession tocan `cookies()` y Prisma (sesión real,
// pedidos HTTP): eso es terreno de los tests E2E, que sí corren contra un
// servidor de verdad. Acá se prueba lo que es lógica pura o interopera con
// `jose` sin necesitar un request: el hash de tokens y el
// firmado/verificado de la cookie de sesión.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { SignJWT } from "jose";
import { hashToken, generateToken, decryptSessionCookie } from "./session";

const SECRET = "test-secret-al-menos-32-caracteres-de-largo";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("hashToken", () => {
  it("el mismo token siempre da el mismo hash", () => {
    expect(hashToken("abc123")).toBe(hashToken("abc123"));
  });

  it("tokens distintos dan hashes distintos", () => {
    expect(hashToken("abc123")).not.toBe(hashToken("abc124"));
  });

  it("nunca devuelve el token en texto plano", () => {
    // sha256 en hex son 64 caracteres: si el hash "abc123" tuviera 6
    // caracteres, sería el token crudo, no un hash.
    const hash = hashToken("abc123");
    expect(hash).not.toBe("abc123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateToken", () => {
  it("genera tokens distintos en cada llamada", () => {
    const tokens = Array.from({ length: 20 }, () => generateToken());
    expect(new Set(tokens).size).toBe(20);
  });

  it("usa un alfabeto seguro para URL (base64url)", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("decryptSessionCookie", () => {
  it("undefined devuelve null sin explotar", async () => {
    expect(await decryptSessionCookie(undefined)).toBeNull();
  });

  it("un string cualquiera (no JWT) devuelve null", async () => {
    expect(await decryptSessionCookie("esto-no-es-un-jwt")).toBeNull();
  });

  it("verifica un JWT firmado con el mismo secreto y saca el sessionId", async () => {
    const key = new TextEncoder().encode(SECRET);
    const jwt = await new SignJWT({ sessionId: "sess_123" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    const decoded = await decryptSessionCookie(jwt);
    expect(decoded).toEqual({ sessionId: "sess_123" });
  });

  it("rechaza un JWT firmado con otro secreto", async () => {
    const wrongKey = new TextEncoder().encode("otro-secreto-completamente-distinto");
    const jwt = await new SignJWT({ sessionId: "sess_123" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongKey);

    expect(await decryptSessionCookie(jwt)).toBeNull();
  });

  it("rechaza un JWT vencido", async () => {
    const key = new TextEncoder().encode(SECRET);
    const jwt = await new SignJWT({ sessionId: "sess_123" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("-1h") // ya vencido al firmarlo
      .sign(key);

    expect(await decryptSessionCookie(jwt)).toBeNull();
  });

  it("rechaza un payload sin sessionId (o con el tipo equivocado)", async () => {
    const key = new TextEncoder().encode(SECRET);
    const jwt = await new SignJWT({ sessionId: 12345 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    expect(await decryptSessionCookie(jwt)).toBeNull();
  });
});

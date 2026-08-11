const mockPrisma = {
  loginToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { createLoginToken, consumeLoginToken } from "./tokens";
import { hashToken } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-al-menos-32-caracteres-de-largo";
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createLoginToken", () => {
  it("guarda el hash del token, nunca el token en texto plano", async () => {
    mockPrisma.loginToken.create.mockResolvedValue({});
    const rawToken = await createLoginToken("user_1", "RESET");

    const call = mockPrisma.loginToken.create.mock.calls[0][0];
    expect(call.data.tokenHash).toBe(hashToken(rawToken));
    expect(call.data.tokenHash).not.toBe(rawToken);
    expect(call.data.userId).toBe("user_1");
    expect(call.data.purpose).toBe("RESET");
  });

  it("una invitación dura más que un reset de contraseña", async () => {
    mockPrisma.loginToken.create.mockResolvedValue({});
    const before = Date.now();

    await createLoginToken("user_1", "INVITE");
    const inviteExpiry = mockPrisma.loginToken.create.mock.calls[0][0].data.expiresAt as Date;

    await createLoginToken("user_1", "RESET");
    const resetExpiry = mockPrisma.loginToken.create.mock.calls[1][0].data.expiresAt as Date;

    expect(inviteExpiry.getTime() - before).toBeGreaterThan(resetExpiry.getTime() - before);
  });
});

describe("consumeLoginToken", () => {
  it("token inexistente devuelve not_found", async () => {
    mockPrisma.loginToken.findUnique.mockResolvedValue(null);
    const result = await consumeLoginToken("cualquiera", "RESET");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("token ya usado devuelve used sin llegar a updateMany", async () => {
    mockPrisma.loginToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      purpose: "RESET",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    const result = await consumeLoginToken("token", "RESET");
    expect(result).toEqual({ ok: false, reason: "used" });
    expect(mockPrisma.loginToken.updateMany).not.toHaveBeenCalled();
  });

  it("token vencido devuelve expired", async () => {
    mockPrisma.loginToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      purpose: "RESET",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    const result = await consumeLoginToken("token", "RESET");
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("purpose distinto al esperado devuelve wrong_purpose", async () => {
    mockPrisma.loginToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      purpose: "INVITE",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    const result = await consumeLoginToken("token", "RESET");
    expect(result).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("token válido lo marca usado y devuelve el userId", async () => {
    mockPrisma.loginToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      purpose: "RESET",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    mockPrisma.loginToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await consumeLoginToken("token", "RESET");
    expect(result).toEqual({ ok: true, userId: "u1" });
    // La condición usedAt:null en el WHERE es lo que hace atómica la
    // carrera de "dos clicks casi simultáneos en el mismo link".
    expect(mockPrisma.loginToken.updateMany).toHaveBeenCalledWith({
      where: { id: "t1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("si otra request ya lo consumió justo antes (count 0), devuelve used", async () => {
    mockPrisma.loginToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      purpose: "RESET",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    // Pasó la validación de lectura, pero el UPDATE atómico no afectó
    // ninguna fila: alguien más ganó la carrera entre el findUnique y acá.
    mockPrisma.loginToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await consumeLoginToken("token", "RESET");
    expect(result).toEqual({ ok: false, reason: "used" });
  });
});

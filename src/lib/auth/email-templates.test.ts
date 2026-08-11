import { renderInviteEmail, renderResetPasswordEmail } from "./email-templates";

describe("renderInviteEmail", () => {
  const result = renderInviteEmail({
    email: "nueva@empresa.com",
    acceptUrl: "https://app.orion.com/accept-invite?token=abc123",
    invitedByEmail: "owner@empresa.com",
  });

  it("el asunto menciona quién invita", () => {
    expect(result.subject).toContain("owner@empresa.com");
  });

  it("el HTML incluye el email invitado y el link de aceptar, dos veces (botón + texto alternativo)", () => {
    expect(result.html).toContain("nueva@empresa.com");
    const occurrences = result.html.split("https://app.orion.com/accept-invite?token=abc123").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("la versión de texto plano no tiene HTML y trae el mismo link", () => {
    expect(result.text).not.toMatch(/<[^>]+>/);
    expect(result.text).toContain("https://app.orion.com/accept-invite?token=abc123");
  });

  it("no es un HTML roto: las etiquetas abren y cierran en cantidades parejas", () => {
    const opens = result.html.match(/<table/g)?.length ?? 0;
    const closes = result.html.match(/<\/table>/g)?.length ?? 0;
    expect(opens).toBe(closes);
  });
});

describe("renderResetPasswordEmail", () => {
  const result = renderResetPasswordEmail({
    email: "alguien@empresa.com",
    resetUrl: "https://app.orion.com/reset-password?token=xyz789",
  });

  it("el asunto es sobre restablecer contraseña, no sobre una invitación", () => {
    expect(result.subject.toLowerCase()).toContain("contraseña");
  });

  it("el HTML incluye el link de reset", () => {
    expect(result.html).toContain("https://app.orion.com/reset-password?token=xyz789");
  });

  it("la versión de texto plano incluye el link", () => {
    expect(result.text).toContain("https://app.orion.com/reset-password?token=xyz789");
  });
});

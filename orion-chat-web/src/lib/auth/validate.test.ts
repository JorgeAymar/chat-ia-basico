import { isValidEmail } from "./validate";

describe("isValidEmail", () => {
  it("acepta emails normales", () => {
    expect(isValidEmail("nombre@dominio.com")).toBe(true);
    expect(isValidEmail("nombre.apellido+tag@sub.dominio.co")).toBe(true);
  });

  it("rechaza strings sin arroba o sin dominio", () => {
    expect(isValidEmail("nombre-dominio.com")).toBe(false);
    expect(isValidEmail("nombre@")).toBe(false);
    expect(isValidEmail("nombre@dominio")).toBe(false);
  });

  it("rechaza espacios", () => {
    expect(isValidEmail("nombre apellido@dominio.com")).toBe(false);
    expect(isValidEmail("nombre@dominio .com")).toBe(false);
  });

  it("rechaza vacío", () => {
    expect(isValidEmail("")).toBe(false);
  });
});

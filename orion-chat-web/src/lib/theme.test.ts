import { isTheme, resolveTheme, DEFAULT_THEME } from "./theme";

describe("theme", () => {
  it("acepta solo light/dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });

  it("resolveTheme cae al default ante valores inválidos", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("nope")).toBe(DEFAULT_THEME);
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
  });
});

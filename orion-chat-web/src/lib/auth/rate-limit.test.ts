import { clearFailures, recordFailure, resetAllForTests, retryAfterSeconds } from "./rate-limit";

describe("rate-limit de login", () => {
  beforeEach(resetAllForTests);

  it("no bloquea hasta llegar al máximo de fallos", () => {
    for (let i = 0; i < 7; i++) recordFailure("a", 1000, 0);
    expect(retryAfterSeconds("a", 8, 1000, 0)).toBe(0);
    recordFailure("a", 1000, 0);
    expect(retryAfterSeconds("a", 8, 1000, 0)).toBeGreaterThan(0);
  });

  it("se libera cuando los fallos salen de la ventana", () => {
    for (let i = 0; i < 8; i++) recordFailure("a", 1000, 0);
    expect(retryAfterSeconds("a", 8, 1000, 500)).toBe(1);
    expect(retryAfterSeconds("a", 8, 1000, 1001)).toBe(0);
  });

  it("claves distintas no se afectan y un acierto limpia el contador", () => {
    for (let i = 0; i < 8; i++) recordFailure("a", 1000, 0);
    expect(retryAfterSeconds("b", 8, 1000, 0)).toBe(0);
    clearFailures("a");
    expect(retryAfterSeconds("a", 8, 1000, 0)).toBe(0);
  });
});

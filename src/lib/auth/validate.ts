// Validación pragmática, no RFC 5322 completa: alcanza para rechazar
// errores de tipeo obvios sin sumar una librería solo para esto.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

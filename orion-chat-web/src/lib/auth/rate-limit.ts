// Freno a intentos de login: ventana deslizante en memoria. Solo se cuentan
// los FALLOS; un login correcto limpia el contador. En memoria porque hay un
// solo contenedor activo (el blue/green solo los superpone unos segundos) y
// reiniciar el contenedor lo resetea — alcanza para frenar fuerza bruta sin
// sumar una tabla; nginx (limit_req) queda como primera barrera.
const failures = new Map<string, number[]>();

export const LOGIN_MAX_FAILURES = 8;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function recent(key: string, windowMs: number, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

// Segundos hasta poder reintentar; 0 si no está bloqueado.
export function retryAfterSeconds(
  key: string,
  max = LOGIN_MAX_FAILURES,
  windowMs = LOGIN_WINDOW_MS,
  now = Date.now()
): number {
  const list = recent(key, windowMs, now);
  if (list.length < max) return 0;
  return Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
}

export function recordFailure(key: string, windowMs = LOGIN_WINDOW_MS, now = Date.now()): void {
  const list = recent(key, windowMs, now);
  list.push(now);
  failures.set(key, list);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

export function resetAllForTests(): void {
  failures.clear();
}

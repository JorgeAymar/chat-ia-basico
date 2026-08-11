import "server-only";
import crypto from "node:crypto";

// scrypt nativo de Node en vez de bcrypt: es una función de derivación de
// clave igual de apta para contraseñas (memory-hard, resiste ataques por
// GPU/ASIC mejor que un hash simple) y no agrega una dependencia con
// binarios nativos que compilar. No hace falta una librería para esto.

export const MIN_PASSWORD_LENGTH = 8;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Formato guardado: "salt:hash", ambos en hex. El salt no es secreto —viaja
// junto al hash a propósito— su único trabajo es que dos contraseñas
// iguales no produzcan el mismo hash (evita ataques de tabla precalculada).
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const derived = await scrypt(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const derived = await scrypt(password, salt);
  const storedBuffer = Buffer.from(hashHex, "hex");

  // timingSafeEqual exige buffers del mismo largo, y tirar en vez de
  // devolver false ahí adentro filtraría por temporización si el hash
  // guardado está corrupto o truncado — se descarta antes de comparar.
  if (derived.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(derived, storedBuffer);
}

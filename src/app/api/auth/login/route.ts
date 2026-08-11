import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isValidEmail } from "@/lib/auth/validate";

// Mismo mensaje exista o no la cuenta, o esté bien o mal la contraseña:
// distinguir "ese email no existe" de "esa contraseña está mal" le regala a
// cualquiera un oráculo para saber qué direcciones tienen cuenta acá.
const INVALID_CREDENTIALS = { error: "Email o contraseña incorrectos" };

// El mensaje genérico de arriba no alcanza solo: si la rama "usuario no
// existe" respondiera al toque mientras la rama "existe" espera un scrypt
// (decenas de ms), el TIEMPO de respuesta sería el oráculo. Por eso se
// calcula `verifyPassword` SIEMPRE, contra este hash fijo cuando no hay uno
// real — computado una sola vez por proceso, no en cada request.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(crypto.randomBytes(32).toString("hex"));
  return dummyHashPromise;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidEmail(email) || !password) {
    return Response.json({ error: "Ingresá tu email y tu contraseña" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const canLogIn = Boolean(user && user.status === "ACTIVE" && user.passwordHash);
  const targetHash = canLogIn ? (user!.passwordHash as string) : await getDummyHash();

  const valid = await verifyPassword(password, targetHash);
  if (!canLogIn || !valid) {
    return Response.json(INVALID_CREDENTIALS, { status: 401 });
  }

  await createSession(user!.id);
  return Response.json({ ok: true });
}

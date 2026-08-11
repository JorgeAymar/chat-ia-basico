import { prisma } from "@/lib/prisma";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

// Atajo exclusivo de desarrollo/tests para dejar al owner con una contraseña
// conocida sin pasar por el flujo real de invitación (que necesitaría un
// owner previo para invitar al primer owner — problema del huevo y la
// gallina). El owner real de producción se crea con `npx tsx
// scripts/bootstrap-owner.ts`, que sí pasa por el mismo camino de "aceptar
// invitación" que cualquier otro usuario.
//
// Dos barreras independientes, no una: NODE_ENV solo no alcanza, porque
// depende de que el deploy arranque con `next start` y no con `next dev`
// por error — un despliegue mal armado dejaría esto expuesto sin login,
// listo para tomar la cuenta OWNER entera con un solo POST. La segunda
// barrera (DEV_AUTH_BYPASS) nunca se declara en un compose de producción,
// así que hace falta un error de configuración doble, no uno solo.
//
// 404 y no 403: un 403 confirma que la ruta existe, un 404 no.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.DEV_AUTH_BYPASS !== "true") {
    return new Response(null, { status: 404 });
  }

  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Falta OWNER_EMAIL en .env" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { role: "OWNER", status: "ACTIVE", passwordHash },
    create: { email, role: "OWNER", status: "ACTIVE", passwordHash, acceptedAt: new Date() },
  });

  return Response.json({ ok: true });
}

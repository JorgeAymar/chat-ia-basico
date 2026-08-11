import { prisma } from "@/lib/prisma";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";
import { createLoginToken } from "@/lib/auth/tokens";
import { renderInviteEmail } from "@/lib/auth/email-templates";
import { sendMail } from "@/lib/auth/mailer";
import { getAppUrl } from "@/lib/auth/urls";
import { isValidEmail } from "@/lib/auth/validate";

// GET: la tabla de usuarios invitados/activos que pidió el usuario — vive acá
// y no en un endpoint aparte porque comparte el mismo guard de "solo owner".
export async function GET() {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;
  if (auth.role !== "OWNER") {
    return Response.json({ error: "Solo el owner puede ver esto" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, status: true, createdAt: true, acceptedAt: true },
  });
  return Response.json({ users });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;
  if (auth.role !== "OWNER") {
    return Response.json({ error: "Solo el owner puede invitar" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return Response.json({ error: "Ingresá un email válido" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (user?.status === "ACTIVE") {
    return Response.json({ error: `"${email}" ya tiene una cuenta activa` }, { status: 400 });
  }
  // Si ya estaba invitado sin aceptar, esto simplemente reenvía la
  // invitación con un token nuevo (el viejo sigue existiendo pero vencerá).
  if (!user) {
    user = await prisma.user.create({ data: { email, invitedById: auth.id } });
  }

  const token = await createLoginToken(user.id, "INVITE");
  // Apunta a una PÁGINA (crea la contraseña ahí), no a una API: la ruta
  // vieja loguéaba directo en el GET, y hacía eso incluso si un escáner de
  // links de algún cliente de correo pre-cargaba la URL antes de que la
  // persona la abriera.
  const acceptUrl = `${getAppUrl()}/accept-invite?token=${token}`;
  const { subject, html, text } = renderInviteEmail({
    email: user.email,
    acceptUrl,
    invitedByEmail: auth.email,
  });

  let emailError: string | null = null;
  try {
    await sendMail({ to: user.email, subject, html, text });
  } catch (err) {
    console.error("No se pudo enviar la invitación:", err);
    emailError = "No se pudo enviar el correo de invitación.";
  }

  // Mismo criterio que /api/auth/login: fuera de producción, un SMTP caído
  // no debería trabar el trabajo — el usuario invitado ya existe y el link
  // sigue siendo válido, solo que nadie lo recibió por correo todavía.
  if (emailError && process.env.NODE_ENV === "production") {
    return Response.json({ error: emailError }, { status: 502 });
  }

  return Response.json({
    user: { id: user.id, email: user.email, role: user.role, status: user.status },
    ...(process.env.NODE_ENV !== "production"
      ? { devAcceptUrl: acceptUrl, ...(emailError ? { emailError } : {}) }
      : {}),
  });
}

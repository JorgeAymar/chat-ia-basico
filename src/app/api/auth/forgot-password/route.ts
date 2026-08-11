import { prisma } from "@/lib/prisma";
import { createLoginToken } from "@/lib/auth/tokens";
import { renderResetPasswordEmail } from "@/lib/auth/email-templates";
import { sendMail } from "@/lib/auth/mailer";
import { getAppUrl } from "@/lib/auth/urls";
import { isValidEmail } from "@/lib/auth/validate";

// Mismo criterio anti-enumeración que en /api/auth/login: la respuesta no
// cambia según si el email existe, está INVITED o ya tiene contraseña.
const GENERIC_RESPONSE = {
  ok: true,
  message: "Si el email tiene una cuenta activa, te mandamos un enlace para restablecer la contraseña.",
};

// El mensaje genérico no alcanza solo: crear el token + mandar el mail (que
// puede tardar hasta el timeout del SMTP, 10s) es mucho más lento que un
// "no existe" instantáneo — esa diferencia de tiempo ES el oráculo que el
// mensaje genérico dice tapar. En producción, ese trabajo se dispara sin
// esperarlo antes de responder, y la respuesta se empareja a un piso fijo.
const MIN_RESPONSE_MS = 400;

async function createAndSendResetEmail(user: { id: string; email: string }) {
  const token = await createLoginToken(user.id, "RESET");
  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
  const { subject, html, text } = renderResetPasswordEmail({ email: user.email, resetUrl });
  try {
    await sendMail({ to: user.email, subject, html, text });
    return { resetUrl, emailError: null };
  } catch (err) {
    // El token ya existe y es válido aunque el mail haya fallado — no se
    // crea uno segundo, se devuelve el mismo con el error aparte.
    console.error("No se pudo enviar el email de reset:", err);
    return { resetUrl, emailError: "No se pudo enviar el correo." };
  }
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    return Response.json({ error: "Ingresa un correo válido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Una cuenta INVITED todavía no tiene contraseña que resetear: el camino
  // para esa persona es aceptar la invitación, no esta pantalla.
  const eligible = user && user.status === "ACTIVE" ? user : null;

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (eligible) {
      // Deliberadamente sin `await`: ver el comentario de MIN_RESPONSE_MS.
      createAndSendResetEmail(eligible).catch((err) => {
        console.error("No se pudo procesar el pedido de reset de contraseña:", err);
      });
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
    }
    return Response.json(GENERIC_RESPONSE);
  }

  // Fuera de producción el timing no es una amenaza real (nadie más que el
  // desarrollador está midiendo esta instancia), así que sí se espera el
  // envío y se expone el link de bypass — igual que en el resto de los
  // endpoints de auth.
  if (!eligible) {
    return Response.json(GENERIC_RESPONSE);
  }

  const { resetUrl, emailError } = await createAndSendResetEmail(eligible);
  return Response.json({
    ...GENERIC_RESPONSE,
    devResetUrl: resetUrl,
    ...(emailError ? { emailError } : {}),
  });
}

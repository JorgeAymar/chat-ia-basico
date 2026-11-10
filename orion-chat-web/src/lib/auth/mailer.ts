import "server-only";
import nodemailer from "nodemailer";

// Un solo transporter reusado entre requests: crear uno por email abriría
// y cerraría la conexión SMTP en cada invitación, que es lento y hace ruido
// en los logs del servidor de correo.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error(
      "Faltan variables SMTP_HOST/SMTP_USER/SMTP_PASSWORD en .env: no se puede mandar el correo."
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    // 465 es SSL/TLS directo; cualquier otro puerto (587 típicamente) es
    // STARTTLS, donde la conexión arranca en texto plano y se cifra después.
    secure: port === 465,
    auth: { user, pass },
    // Sin esto, un SMTP inalcanzable (red bloqueada, servidor caído) cuelga
    // el request casi un minuto antes de fallar — muy por encima de lo que
    // cualquiera espera de un botón "enviarme el enlace".
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return transporter;
}

export async function sendMail(options: { to: string; subject: string; html: string; text: string }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({ from, ...options });
}

import { APP_NAME } from "@/lib/app-info";

// Plantillas de email con estilos inline y layout de tablas: es feo de leer
// en el código, pero es lo único que renderiza igual en Outlook, Gmail y
// Apple Mail — esos clientes no soportan CSS externo ni, en el caso de
// Outlook, buena parte del CSS moderno (flexbox, grid). No se puede reusar
// el CSS de la app acá.
//
// La paleta es la misma "Orion Corporate" (navy #1e3a5f + slate) del resto
// de la app, para que el correo se sienta parte del mismo producto.

const NAVY = "#1e3a5f";
const INK = "#0f172a";
const INK_DIM = "#64748b";
const LINE = "#e2e8f0";
const VOID = "#f8fafc";
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function baseTemplate(options: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
}): string {
  const { preheader, heading, bodyHtml, buttonLabel, buttonUrl, footerNote } = options;

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${APP_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background:${VOID}; font-family:${FONT_STACK};">
    <!-- Preheader: texto que algunos clientes muestran junto al asunto en la
         bandeja de entrada, oculto en el cuerpo del mensaje. -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${VOID}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background:#ffffff; border:1px solid ${LINE}; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:28px; height:28px; background:${NAVY}; border-radius:6px; text-align:center; vertical-align:middle; font-weight:700; color:#ffffff; font-size:13px; font-family:${FONT_STACK};">
                      O
                    </td>
                    <td style="padding-left:10px; font-weight:600; font-size:15px; color:${INK}; font-family:${FONT_STACK};">
                      ${APP_NAME}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <h1 style="margin:0 0 12px 0; font-size:19px; line-height:1.35; color:${INK}; font-family:${FONT_STACK};">
                  ${heading}
                </h1>
                <div style="font-size:14px; line-height:1.6; color:${INK_DIM}; font-family:${FONT_STACK};">
                  ${bodyHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px; background:${NAVY};">
                      <a href="${buttonUrl}" target="_blank" style="display:inline-block; padding:11px 22px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; font-family:${FONT_STACK};">
                        ${buttonLabel}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${INK_DIM}; font-family:${FONT_STACK}; word-break:break-all;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
                  <a href="${buttonUrl}" style="color:${NAVY};">${buttonUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px; border-top:1px solid ${LINE}; background:${VOID};">
                <p style="margin:0; font-size:11px; line-height:1.5; color:${INK_DIM}; font-family:${FONT_STACK};">
                  ${footerNote}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderInviteEmail(options: { email: string; acceptUrl: string; invitedByEmail: string }) {
  const { email, acceptUrl, invitedByEmail } = options;
  return {
    subject: `${invitedByEmail} te invitó a ${APP_NAME}`,
    html: baseTemplate({
      preheader: `Tienes una invitación a ${APP_NAME} de parte de ${invitedByEmail}.`,
      heading: `${invitedByEmail} te invitó a sumarte a ${APP_NAME}`,
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Hola,</p>
        <p style="margin:0 0 12px 0;">
          Te invitaron a usar <strong style="color:${INK};">${APP_NAME}</strong> con la cuenta
          <strong style="color:${INK};">${email}</strong>. Da clic en el botón de abajo para crear tu
          contraseña y activar tu acceso.
        </p>
        <p style="margin:0;">Este enlace vence en 7 días y solo funciona una vez.</p>
      `,
      buttonLabel: "Crear mi contraseña",
      buttonUrl: acceptUrl,
      footerNote: `Si no esperabas esta invitación, puedes ignorar este correo: tu dirección no queda registrada hasta que la aceptes.`,
    }),
    text: `${invitedByEmail} te invitó a ${APP_NAME}.\n\nCrea tu contraseña con este enlace (vence en 7 días, un solo uso):\n${acceptUrl}\n\nSi no esperabas esta invitación, puedes ignorar este correo.`,
  };
}

export function renderResetPasswordEmail(options: { email: string; resetUrl: string }) {
  const { email, resetUrl } = options;
  return {
    subject: `Restablecer tu contraseña de ${APP_NAME}`,
    html: baseTemplate({
      preheader: `Elige una contraseña nueva para tu cuenta de ${APP_NAME}.`,
      heading: "Restablecer tu contraseña",
      bodyHtml: `
        <p style="margin:0 0 12px 0;">Hola,</p>
        <p style="margin:0 0 12px 0;">
          Pediste restablecer la contraseña de <strong style="color:${INK};">${APP_NAME}</strong> para
          la cuenta <strong style="color:${INK};">${email}</strong>. Da clic en el botón de abajo para
          elegir una nueva.
        </p>
        <p style="margin:0;">Este enlace vence en 30 minutos y solo funciona una vez.</p>
      `,
      buttonLabel: "Elegir nueva contraseña",
      buttonUrl: resetUrl,
      footerNote: `Si no pediste este cambio, puedes ignorar este correo: tu contraseña actual sigue funcionando sin cambios.`,
    }),
    text: `Restablecer tu contraseña de ${APP_NAME} (vence en 30 minutos, un solo uso):\n${resetUrl}\n\nSi no pediste este cambio, puedes ignorar este correo.`,
  };
}

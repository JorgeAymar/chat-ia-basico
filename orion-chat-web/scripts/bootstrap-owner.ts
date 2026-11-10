// Script de una sola corrida para crear el primer usuario (OWNER_EMAIL) de
// una instancia nueva. No le pone contraseña directamente: genera un enlace
// de invitación real y lo imprime (además de intentar mandarlo por correo),
// para que el owner pase por el mismo camino de "crear tu contraseña" que
// cualquier otra persona invitada — sin caso especial para el primer usuario.
//
// Uso: npx tsx scripts/bootstrap-owner.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { createLoginToken } from "../src/lib/auth/tokens";
import { renderInviteEmail } from "../src/lib/auth/email-templates";
import { sendMail } from "../src/lib/auth/mailer";
import { getAppUrl } from "../src/lib/auth/urls";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("Falta OWNER_EMAIL en .env");
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (user?.passwordHash) {
    console.log(`"${email}" ya tiene contraseña configurada. No hay nada que hacer.`);
    return;
  }

  if (!user) {
    user = await prisma.user.create({ data: { email, role: "OWNER", status: "INVITED" } });
    console.log(`Usuario owner creado: ${email}`);
  } else if (user.role !== "OWNER") {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: "OWNER" } });
  }

  const token = await createLoginToken(user.id, "INVITE");
  const acceptUrl = `${getAppUrl()}/accept-invite?token=${token}`;

  console.log("\nEnlace para crear la contraseña (vence en 7 días, un solo uso):");
  console.log(acceptUrl, "\n");

  try {
    const { subject, html, text } = renderInviteEmail({
      email,
      acceptUrl,
      invitedByEmail: "el sistema",
    });
    await sendMail({ to: email, subject, html, text });
    console.log(`Además se lo mandé por correo a ${email}.`);
  } catch (err) {
    console.warn(
      "No se pudo enviar el correo (revisá la config de SMTP en .env). Usá el enlace de arriba directamente.",
      err
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

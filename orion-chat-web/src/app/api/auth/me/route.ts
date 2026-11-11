import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { resolveTheme } from "@/lib/theme";

// 200 con user:null cuando no hay sesión, no 401: esto no protege un
// recurso, es la consulta "¿quién soy?" que hace la UI en cada carga para
// decidir si mostrar el chat o mandar a /login.
export async function GET() {
  const user = await verifySession();
  if (!user) return Response.json({ user: null });

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { theme: true } });
  return Response.json({ user: { ...user, theme: resolveTheme(row?.theme) } });
}

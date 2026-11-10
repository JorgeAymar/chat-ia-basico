import { verifySession } from "@/lib/auth/dal";

// 200 con user:null cuando no hay sesión, no 401: esto no protege un
// recurso, es la consulta "¿quién soy?" que hace la UI en cada carga para
// decidir si mostrar el chat o mandar a /login.
export async function GET() {
  const user = await verifySession();
  return Response.json({ user });
}

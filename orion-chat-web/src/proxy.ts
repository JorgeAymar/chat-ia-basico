import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, decryptSessionCookie } from "@/lib/auth/session";

// En Next.js 16 esto se llama Proxy (antes "Middleware"; el comportamiento
// es el mismo). Corre en cada request de página y hace un chequeo
// OPTIMISTA: solo desencripta la cookie, sin tocar la base — la doc lo pide
// así explícitamente porque Proxy también corre en rutas prefetcheadas, y
// una consulta a la base ahí sería demasiado.
//
// Este chequeo NO es la autorización real: cada Route Handler vuelve a
// validar la sesión contra la tabla `Session` (ver src/lib/auth/dal.ts). Si
// alguien arma una cookie con una firma inválida, esto la rechaza; si la
// firma es válida pero la sesión ya se borró en la base (logout, expiró),
// esto no se entera y deja pasar — para eso está la segunda verificación.
const PUBLIC_PATHS = new Set(["/login", "/accept-invite", "/forgot-password", "/reset-password"]);

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  const session = await decryptSessionCookie(req.cookies.get(COOKIE_NAME)?.value);

  // Bajo basePath (/app), req.nextUrl.pathname llega SIN el prefijo y
  // clonar nextUrl + cambiar pathname lo conserva al serializar: así los
  // redirects quedan en /app/... sin armar la URL a mano.
  if (!isPublic && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublic && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Deja pasar sin chequeo: las rutas de API (cada una valida su propia
// sesión y responde JSON, no tiene sentido redirigirlas a /login con HTML),
// los assets de Next, y los íconos (rutas icon-32/icon-180) — sin esto, un
// visitante sin sesión en /login recibía un redirect en vez del ícono.
//
// "/" va aparte a propósito: bajo basePath el patrón de abajo compila a
// ^/app/(...) con la barra obligatoria, y la raíz de la app ("/app", sin
// barra final — Next redirige /app/ → /app) quedaba sin proxy y se servía
// sin pedir login.
export const config = {
  matcher: ["/", "/((?!api|_next/static|_next/image|favicon.ico|icon-).*)"],
};

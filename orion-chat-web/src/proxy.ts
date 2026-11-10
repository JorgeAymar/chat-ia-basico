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

  if (!isPublic && !session) {
    // La raíz es la única página protegida que puede pisar alguien sin
    // cuenta (todo lo demás no autenticado ya cae en PUBLIC_PATHS): en vez
    // de un formulario de login sin contexto, que vea primero la landing
    // (orion-chat-landing/, HTML estático servido directo por nginx en
    // /presentacion — nunca llega a este proceso de Next).
    const destination = pathname === "/" ? "/presentacion" : "/login";
    return NextResponse.redirect(new URL(destination, req.url));
  }

  if (isPublic && session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

// Deja pasar sin chequeo: las rutas de API (cada una valida su propia
// sesión y responde JSON, no tiene sentido redirigirlas a /login con HTML),
// los assets de Next, y el favicon/icon/apple-icon (generados por
// src/app/icon.tsx y apple-icon.tsx) — sin esto, un visitante sin sesión en
// /login recibía un redirect en vez del ícono y la pestaña se quedaba sin
// favicon.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};

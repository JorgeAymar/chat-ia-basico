// Nombre y versión de la app, configurables desde .env como APP_NAME y
// APP_VERSION.
//
// Van sin el prefijo NEXT_PUBLIC_ a propósito. Como igual las necesita el
// sidebar —que corre en el navegador— se exponen al cliente desde la clave
// `env` de next.config.ts, que inyecta al bundle las variables que se listen
// ahí conservando su nombre. Si sacás esa entrada de next.config.ts, acá
// llegan como undefined y se caen a los valores de abajo.
//
// Hay que leerlas como `process.env.APP_NAME` completo: Next reemplaza esa
// expresión literal al compilar, así que una desestructuración o un acceso
// dinámico (`process.env[clave]`) no se sustituye.
//
// Los defaults existen para que la app arranque con un .env incompleto en vez
// de mostrar "undefined" en el encabezado.

export const APP_NAME = process.env.APP_NAME || "Orion Chat";
export const APP_VERSION = process.env.APP_VERSION || "0.0.0";

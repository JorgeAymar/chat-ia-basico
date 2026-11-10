import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera `.next/standalone`: un servidor Node mínimo con solo los archivos
  // que realmente hacen falta en runtime, sin `node_modules` completo. Es lo
  // que permite que la imagen Docker de producción pese una fracción de lo
  // que pesaría copiando el proyecto entero.
  output: "standalone",

  // El rastreo automático de Next sigue imports/require estáticos, pero el
  // motor de consultas de Prisma se resuelve por ruta en tiempo de
  // ejecución (no es un `require()` literal que el rastreo pueda seguir) —
  // sin esto, el build standalone queda sin el binario y explota recién al
  // arrancar el contenedor. El cliente se genera en `src/generated/prisma`
  // (salida custom, no la default de `node_modules/@prisma/client`).
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },

  // El nombre y la versión de la app se configuran en .env como APP_NAME y
  // APP_VERSION, sin prefijo. Pero las lee el sidebar, que corre en el
  // navegador, y por defecto Next solo expone al cliente las variables que
  // empiezan con NEXT_PUBLIC_.
  //
  // Esta clave `env` es la salida documentada para eso: inyecta al bundle las
  // variables que se listen acá, con el nombre que tengan. Es lo que permite
  // mantener APP_NAME/APP_VERSION en vez de ensuciarlas con un prefijo.
  //
  // Contrapartida: los valores se congelan al compilar, así que después de
  // tocarlos en .env hay que reiniciar el servidor de desarrollo.
  env: {
    APP_NAME: process.env.APP_NAME ?? "Orion Chat",
    APP_VERSION: process.env.APP_VERSION ?? "0.0.0",
  },
};

export default nextConfig;

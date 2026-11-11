import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
// Los estilos de KaTeX vienen del paquete: sin esto las fórmulas se
// renderizan como una pila de spans sueltos ilegible.
import "katex/dist/katex.min.css";
import "./globals.css";
import { cookies } from "next/headers";
import { APP_NAME } from "@/lib/app-info";
import { THEME_COOKIE, resolveTheme } from "@/lib/theme";
import { withBase } from "@/lib/base-path";

// Sora para títulos (geometría condensada y moderna), Inter para el
// cuerpo —neutra y legible para texto de chat/UI. Compartidas con la app
// mobile y la landing.
const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// Monoespaciada para código (bloques e inline), como en el diseño de Stitch.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Chat con modelos de Ollama: streaming, búsqueda web con citas, adjuntos y memoria persistente.",
  // Declarados a mano: bajo basePath, el <link> automático de la convención
  // icon.tsx sale sin /app (ver src/app/icon-32/route.tsx).
  icons: {
    icon: withBase("/icon-32"),
    apple: withBase("/icon-180"),
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El tema se resuelve en el servidor (cookie sembrada al loguearse o al
  // cambiarlo en el perfil): si se aplicara recién en el cliente, cada carga
  // arrancaría en oscuro y "saltaría" a claro.
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="es"
      data-theme={theme}
      className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

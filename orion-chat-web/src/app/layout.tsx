import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
// Los estilos de KaTeX vienen del paquete: sin esto las fórmulas se
// renderizan como una pila de spans sueltos ilegible.
import "katex/dist/katex.min.css";
import "./globals.css";
import { APP_NAME } from "@/lib/app-info";

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

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Chat con modelos de Ollama: streaming, búsqueda web con citas, adjuntos y memoria persistente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

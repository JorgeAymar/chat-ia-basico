import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter } from "next/font/google";
// Los estilos de KaTeX vienen del paquete: sin esto las fórmulas se
// renderizan como una pila de spans sueltos ilegible.
import "katex/dist/katex.min.css";
import "./globals.css";
import { APP_NAME } from "@/lib/app-info";

// Tipografía del rediseño corporativo (sistema de diseño "Orion Corporate"
// generado en Stitch): IBM Plex Sans para títulos, Inter para el cuerpo. Se
// reemplazó Plus Jakarta Sans por Inter porque es la que da el aire "panel
// interno de empresa" en vez de "producto de consumo".
const plexSans = IBM_Plex_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
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
      className={`${plexSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
// Los estilos de KaTeX vienen del paquete: sin esto las fórmulas se
// renderizan como una pila de spans sueltos ilegible.
import "katex/dist/katex.min.css";
import "./globals.css";
import { APP_NAME } from "@/lib/app-info";

// Tipografía del rediseño oscuro/oliva: Plus Jakarta Sans para títulos (su
// geometría redondeada y amigable es justo el aire "producto de consumo"
// que la paleta anterior evitaba a propósito), Inter para el cuerpo —se
// mantiene, ya es neutra y legible para texto de chat/UI.
const plusJakarta = Plus_Jakarta_Sans({
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
      className={`${plusJakarta.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

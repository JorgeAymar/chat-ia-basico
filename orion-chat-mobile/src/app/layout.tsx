import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { apiUrl } from "@/lib/base-path";

// Mismas familias que el cliente web (ver su layout.tsx): Sora para títulos,
// Inter para cuerpo — mismo design system que el cliente web y la landing.
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
  title: "Orion Chat",
  description: "Chat con modelos de Ollama, optimizado para mobile.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Orion Chat",
  },
  // icon-32/icon-180 son rutas comunes (Route Handlers), no la convención
  // especial icon.tsx/apple-icon.tsx: se probó esa convención primero y,
  // bajo basePath, el <link> que arma sola NO lleva el prefijo (apuntaba a
  // /icon en vez de /m/icon y tiraba 404) — a diferencia del <link
  // rel="manifest">, que sí lo lleva. Como ruta común sí se puede declarar
  // acá a mano con `apiUrl`, el mismo prefijo que ya hace falta para
  // fetch() y manifest.ts.
  icons: {
    icon: apiUrl("/icon-32"),
    apple: apiUrl("/icon-180"),
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full overscroll-none">{children}</body>
    </html>
  );
}

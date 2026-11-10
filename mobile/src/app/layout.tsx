import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

// Mismas familias que el cliente web (ver su layout.tsx): Sora para títulos,
// Inter para cuerpo — parte del mismo design system "Orion Navy Fintech".
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
};

export const viewport: Viewport = {
  themeColor: "#0f1b30",
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

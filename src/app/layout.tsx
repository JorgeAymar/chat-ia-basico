import type { Metadata } from "next";
import { IBM_Plex_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat-IA · Chat local con Ollama",
  description: "Chat privado conectado a Ollama, corriendo en tu máquina.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${plexSans.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

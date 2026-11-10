import type { MetadataRoute } from "next";

// Lo que hace instalable a esta PWA. Los colores coinciden con los tokens de
// globals.css (--void y --accent-bright) y el design system de Stitch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orion Chat",
    short_name: "Orion",
    description: "Chat con modelos de Ollama, optimizado para mobile.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1b30",
    theme_color: "#0f1b30",
    icons: [
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

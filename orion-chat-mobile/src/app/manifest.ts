import type { MetadataRoute } from "next";
import { apiUrl } from "@/lib/base-path";

// Lo que hace instalable a esta PWA. Los colores coinciden con los tokens de
// globals.css (--void y --accent-bright) y el design system de Stitch.
//
// `src`/`start_url` se arman con `apiUrl` (prefijo /m en producción): a
// diferencia de next/link, Next NO prefija solo los campos de este objeto
// con basePath — son strings literales que el navegador pide tal cual.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orion Chat",
    short_name: "Orion",
    description: "Chat con modelos de Ollama, optimizado para mobile.",
    start_url: apiUrl("/"),
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      { src: apiUrl("/icon-512"), sizes: "512x512", type: "image/png" },
      { src: apiUrl("/icon-512"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

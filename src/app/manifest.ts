import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ranking Equipos VFV · Pádel X4",
    short_name: "Ranking VFV",
    description: "Clasificación, grupos y resultados de la liga de pádel por equipos VFV",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#0a0f1a",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VFV Pádel",
    short_name: "VFV Pádel",
    description: "Rankings, grupos y resultados de la liga de pádel",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#15803d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

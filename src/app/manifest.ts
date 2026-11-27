import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" no celular, como se fosse um app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agenda Salão",
    short_name: "Agenda",
    description: "Agende seu horário no salão pelo celular.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7c3aed",
    lang: "pt-BR",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

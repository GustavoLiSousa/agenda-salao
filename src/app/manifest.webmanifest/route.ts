// Manifesto do site geral. Cada salão tem o seu em /[slug]/app.webmanifest
// (definido no layout do salão), que substitui este nas páginas do salão.
export function GET() {
  const manifest = {
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
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

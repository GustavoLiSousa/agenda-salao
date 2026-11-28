// App instalável do cliente: abre em "Meus agendamentos".
export function GET() {
  const manifest = {
    id: "/minha-conta",
    name: "Central do cliente",
    short_name: "Meus horários",
    description: "Veja, remarque ou desmarque seus horários no salão.",
    start_url: "/minha-conta",
    scope: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#1c1917",
    lang: "pt-BR",
    icons: [
      { src: "/minha-conta/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/minha-conta/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/minha-conta/pwa-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

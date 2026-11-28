import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// Manifesto do app instalável de cada salão (abre direto na página do salão).
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("name, slug")
    .eq("slug", slug)
    .maybeSingle<{ name: string; slug: string }>();
  if (!salon) return new Response("Not found", { status: 404 });

  const manifest = {
    id: `/${salon.slug}`,
    name: salon.name,
    short_name: salon.name.length > 14 ? salon.name.slice(0, 14).trim() : salon.name,
    description: `Agende seu horário em ${salon.name}.`,
    start_url: `/${salon.slug}`,
    scope: "/",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#1c1917",
    lang: "pt-BR",
    icons: [
      { src: `/${salon.slug}/pwa-icon?size=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/${salon.slug}/pwa-icon?size=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/${salon.slug}/pwa-icon?size=512&maskable=1`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agendar horário", url: `/${salon.slug}/agendar` },
      { name: "Central do cliente", url: `/minha-conta?salao=${salon.slug}` },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

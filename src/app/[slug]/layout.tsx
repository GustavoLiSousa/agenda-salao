import type { Metadata } from "next";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// Cada salão vira um "app" próprio na tela do celular: nome, ícone e
// endereço inicial do salão (em vez do site geral).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{3,60}$/.test(slug)) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("salons").select("name").eq("slug", slug).maybeSingle<{ name: string }>();
  if (!data) return {};
  return {
    manifest: `/${slug}/app.webmanifest`,
    appleWebApp: { capable: true, title: data.name, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: `/${slug}/pwa-icon?size=192`, sizes: "192x192", type: "image/png" }],
      apple: [{ url: `/${slug}/pwa-icon?size=180`, sizes: "180x180", type: "image/png" }],
    },
  };
}

export default function SalonLayout({ children }: { children: React.ReactNode }) {
  return children;
}

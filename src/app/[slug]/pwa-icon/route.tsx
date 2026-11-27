import { ImageResponse } from "next/og";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// Ícone do app do salão: o logo (quando é PNG/JPG) ou a inicial do nome.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const size = [180, 192, 512].includes(Number(url.searchParams.get("size"))) ? Number(url.searchParams.get("size")) : 192;
  const maskable = url.searchParams.has("maskable");

  let name = "A";
  let logo: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("salons")
      .select("name, logo_url")
      .eq("slug", slug)
      .maybeSingle<{ name: string; logo_url: string | null }>();
    if (data) {
      name = data.name;
      if (data.logo_url) logo = await asDataUrl(data.logo_url);
    }
  }

  // ícone "maskable": o celular recorta as bordas, então o logo fica menor no centro
  const inner = maskable ? Math.round(size * 0.7) : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={inner} height={inner} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <span style={{ color: "#d6b57d", fontSize: inner * 0.55, fontWeight: 700 }}>
            {name.trim()[0]?.toUpperCase() ?? "A"}
          </span>
        )}
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=86400" } },
  );
}

async function asDataUrl(src: string) {
  try {
    const res = await fetch(src, { cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/image\/(png|jpe?g)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

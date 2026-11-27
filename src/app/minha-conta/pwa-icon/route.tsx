import { ImageResponse } from "next/og";

// Ícone do app "Meus agendamentos": calendário dourado sobre fundo escuro.
export function GET(request: Request) {
  const url = new URL(request.url);
  const size = [180, 192, 512].includes(Number(url.searchParams.get("size"))) ? Number(url.searchParams.get("size")) : 192;
  const inner = Math.round(size * (url.searchParams.has("maskable") ? 0.42 : 0.56));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1c1917" }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" stroke="#d6b57d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5Z" />
          <path d="m8.5 14.5 2.3 2.3 4.7-4.7" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=86400" } },
  );
}

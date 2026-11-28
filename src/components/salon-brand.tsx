"use client";

import { usePathname } from "next/navigation";
import { NAV } from "./painel-nav";

export type SalonBrandInfo = { name: string; logo_url: string | null; cover_url?: string | null };

/** Logo do salão (ou a inicial, se não tiver logo). */
export function SalonLogo({ salon, className = "h-9 w-9" }: { salon: SalonBrandInfo; className?: string }) {
  return salon.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={salon.logo_url} alt="" className={`${className} shrink-0 rounded-xl object-cover`} />
  ) : (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-orange-400 font-display font-semibold text-white`}
    >
      {salon.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Faixa com a capa e o logo do salão no topo de cada tela do painel (o Início tem a sua própria). */
export function SalonBanner({ salon }: { salon: SalonBrandInfo }) {
  const path = usePathname();
  if (path === "/painel" || path.startsWith("/painel/novo-salao")) return null;
  const section = [...NAV].reverse().find((n) => n.href !== "/painel" && path.startsWith(n.href));
  return (
    <div className="relative isolate mb-5 flex h-20 items-center gap-3 overflow-hidden rounded-2xl px-4 text-white sm:h-24">
      <SalonCover salon={salon} />
      <SalonLogo salon={salon} className="h-11 w-11 ring-2 ring-white/40" />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">{salon.name}</p>
        <p className="truncate font-display text-xl font-semibold">{section?.label ?? "Painel"}</p>
      </div>
    </div>
  );
}

/** Fundo com a foto de capa do salão (ou um gradiente vivo) e um véu escuro por cima. */
export function SalonCover({ salon }: { salon: SalonBrandInfo }) {
  return (
    <>
      {salon.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={salon.cover_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(90%_140%_at_100%_0%,#c026d3_0%,transparent_55%),radial-gradient(80%_120%_at_0%_100%,#f97316_0%,transparent_55%),linear-gradient(135deg,#1e1033,#3b0d3f)]" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-stone-950/20" />
    </>
  );
}

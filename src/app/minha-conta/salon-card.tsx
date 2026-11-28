import Link from "next/link";
import { Card } from "@/components/ui";
import { Icon, ICON_TONE } from "@/components/icons";
import { whatsappLink } from "@/lib/format";
import { toggleFavoriteSalon } from "./actions";

export type SalonSummary = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  whatsapp: string | null;
  rating?: { average: number; total: number } | null;
};

/** Atalho do salão com ícone colorido (sem link fica apagado). */
function SalonAction({
  href,
  icon,
  label,
  external,
}: {
  href?: string;
  icon: "calendar" | "route" | "whatsapp";
  label: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white shadow ${ICON_TONE[icon]}`}
      >
        <Icon name={icon} size={18} />
      </span>
      {label}
    </>
  );
  const cls =
    "flex flex-col items-center gap-1 rounded-xl border border-stone-200 px-1 py-2 text-center text-[11px] font-medium text-stone-700 transition dark:border-stone-700 dark:text-stone-200";
  if (!href) return <span className={`${cls} opacity-35 grayscale`}>{inner}</span>;
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} hover:border-stone-400`}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={`${cls} hover:border-stone-400`}>
      {inner}
    </Link>
  );
}

/** Um salão na área do cliente: agendar, ver a página, como chegar e WhatsApp. */
export function SalonCard({ s, saved, back = "/minha-conta" }: { s: SalonSummary; saved: boolean; back?: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Link href={`/${s.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          {s.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-xl font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
              {s.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{s.name}</p>
            {s.rating && s.rating.total > 0 && (
              <p className="text-xs text-stone-500">
                <span className="text-amber-500">★</span> {s.rating.average.toFixed(1).replace(".", ",")} ·{" "}
                {s.rating.total} {s.rating.total === 1 ? "avaliação" : "avaliações"}
              </p>
            )}
            {s.address && <p className="truncate text-xs text-stone-500">{s.address}</p>}
            <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Serviços, avaliações e horários ›</p>
          </div>
        </Link>
        <FavoriteButton salonId={s.id} saved={saved} back={back} />
      </div>
      <Link
        href={`/${s.slug}`}
        className="rounded-xl bg-[linear-gradient(110deg,#c026d3,#f43f5e_60%,#fb923c)] px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-fuchsia-900/20 transition hover:opacity-95"
      >
        Abrir salão
      </Link>
      <div className="grid grid-cols-3 gap-2">
        <SalonAction href={`/${s.slug}/agendar`} icon="calendar" label="Agendar" />
        {s.address ? (
          <SalonAction
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`}
            icon="route"
            label="Como chegar"
            external
          />
        ) : (
          <SalonAction icon="route" label="Sem endereço" />
        )}
        {s.whatsapp ? (
          <SalonAction href={whatsappLink(s.whatsapp, `Olá, ${s.name}!`)} icon="whatsapp" label="WhatsApp" external />
        ) : (
          <SalonAction icon="whatsapp" label="Sem WhatsApp" />
        )}
      </div>
    </Card>
  );
}

export function FavoriteButton({ salonId, saved, back }: { salonId: string; saved: boolean; back: string }) {
  return (
    <form action={toggleFavoriteSalon} className="shrink-0">
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="saved" value={saved ? "1" : "0"} />
      <input type="hidden" name="back" value={back} />
      <button
        className={`flex flex-col items-center rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition ${
          saved
            ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200"
            : "border-stone-200 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-300"
        }`}
        aria-pressed={saved}
      >
        <span className="text-lg leading-none">{saved ? "♥" : "♡"}</span>
        {saved ? "Meu salão" : "Salvar"}
      </button>
    </form>
  );
}

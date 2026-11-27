import Link from "next/link";
import { Card } from "@/components/ui";
import { whatsappLink } from "@/lib/format";

export type SalonSummary = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  whatsapp: string | null;
  rating?: { average: number; total: number } | null;
};

const small =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-400 dark:border-stone-700 dark:text-stone-200";

/** Um salão na área do cliente: agendar, ver a página, como chegar e WhatsApp. */
export function SalonCard({ s }: { s: SalonSummary }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
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
        </div>
      </div>
      <Link
        href={`/${s.slug}/agendar`}
        className="rounded-xl bg-stone-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
      >
        Agendar horário
      </Link>
      <div className="grid grid-cols-3 gap-2">
        <Link href={`/${s.slug}`} className={small}>
          Profissionais e avaliações
        </Link>
        {s.address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`}
            target="_blank"
            rel="noreferrer"
            className={small}
          >
            Como chegar
          </a>
        ) : (
          <span className={`${small} opacity-40`}>Sem endereço</span>
        )}
        {s.whatsapp ? (
          <a href={whatsappLink(s.whatsapp, `Olá, ${s.name}!`)} target="_blank" rel="noreferrer" className={small}>
            WhatsApp
          </a>
        ) : (
          <span className={`${small} opacity-40`}>Sem WhatsApp</span>
        )}
      </div>
    </Card>
  );
}

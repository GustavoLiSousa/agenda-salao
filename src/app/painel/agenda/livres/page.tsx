import Link from "next/link";
import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui";
import { whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";
import { freeSlots, toRanges } from "@/lib/free-slots";
import { can } from "@/lib/permissions";
import { addDays, isValidDay, shortDay, todayIn } from "@/lib/time";
import { ShareArt } from "./share-art";

export const metadata = { title: "Horários livres | Agenda Salão" };

export default async function LivresPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; prof?: string; dias?: string }>;
}) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;
  const day = isValidDay(q.data) ? q.data : todayIn(tz, 1);
  const days = q.dias === "7" ? 7 : 1;
  const last = addDays(day, days - 1);

  // Funcionário sem acesso à agenda da equipe só divulga os próprios horários
  const onlyMine = !can(membership, "agenda_equipe");
  const prof = onlyMine ? (membership.professional_id ?? "00000000-0000-0000-0000-000000000000") : (q.prof ?? null);
  const perPro = (await freeSlots(supabase, salon.id, day, last, prof)).map((x) => ({
    pro: x.pro,
    byDay: new Map([...x.byDay].map(([k, list]) => [k, toRanges(list, x.pro.slot_step_min, x.dur, tz)])),
  }));

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const link = `${proto}://${host}/${salon.slug}/agendar`;

  const lines: string[] = [`✨ Horários livres – ${salon.name}`];
  for (let i = 0; i < days; i++) {
    const d = addDays(day, i);
    const dayLines = perPro
      .filter((x) => x.byDay.get(d)?.length)
      .map((x) => `${x.pro.name}: ${x.byDay.get(d)!.join(", ")}`);
    if (!dayLines.length) continue;
    lines.push("", `📅 ${shortDay(d)}`, ...dayLines);
  }
  const hasAny = lines.length > 1;
  lines.push("", `Agende pelo link: ${link}`);
  const text = lines.join("\n");

  const qs = (p: Record<string, string>) => {
    const s = new URLSearchParams({ data: day, dias: String(days), ...(prof ? { prof } : {}), ...p });
    return `/painel/agenda/livres?${s}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/painel/agenda" className="text-sm text-brand-700 dark:text-brand-300">
        ‹ Agenda
      </Link>
      <h1 className="font-display text-3xl font-semibold">Horários livres</h1>
      <p className="text-sm text-stone-500">
        Baixe a arte ou copie o texto e poste no seu status, Instagram ou mande para os clientes.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={qs({ data: addDays(day, -1) })}
          className="rounded-lg border border-stone-300 px-3 py-1 dark:border-stone-700"
        >
          ‹
        </Link>
        <span className="font-semibold first-letter:uppercase">
          {days === 1 ? shortDay(day) : `${shortDay(day)} a ${shortDay(last)}`}
        </span>
        <Link
          href={qs({ data: addDays(day, 1) })}
          className="rounded-lg border border-stone-300 px-3 py-1 dark:border-stone-700"
        >
          ›
        </Link>
        <Link
          href={qs({ dias: days === 1 ? "7" : "1" })}
          className="ml-auto rounded-lg border border-stone-300 px-3 py-1 dark:border-stone-700"
        >
          {days === 1 ? "Ver 7 dias" : "Ver 1 dia"}
        </Link>
      </div>

      <Card>
        {hasAny ? (
          <pre className="whitespace-pre-wrap font-sans text-sm">{text}</pre>
        ) : (
          <p className="text-sm text-stone-500">Nenhum horário livre nesse período.</p>
        )}
      </Card>

      {days === 1 && (
        <ShareArt
          src={`/painel/agenda/livres/arte?${new URLSearchParams({ data: day, ...(prof ? { prof } : {}) })}`}
          fileName={`horarios-livres-${day}.png`}
          caption={text}
        />
      )}

      {hasAny && (
        <div className="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <a
            href={whatsappLink(null, text)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Enviar no WhatsApp
          </a>
        </div>
      )}
    </main>
  );
}

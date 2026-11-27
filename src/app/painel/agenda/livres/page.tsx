import Link from "next/link";
import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui";
import { whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";
import { addDays, dayKey, formatTime, isValidDay, shortDay, todayIn } from "@/lib/time";

export const metadata = { title: "Horários livres | Agenda Salão" };

type Pro = { id: string; name: string; slot_step_min: number };

/** Junta horários seguidos em faixas: 09:00–11:30 */
function toRanges(starts: string[], stepMin: number, durMin: number, tz: string) {
  const out: string[] = [];
  let first: number | null = null;
  let last: number | null = null;
  const flush = () => {
    if (first === null || last === null) return;
    out.push(`${formatTime(new Date(first), tz)}–${formatTime(new Date(last + durMin * 60_000), tz)}`);
  };
  for (const s of starts.map((x) => Date.parse(x))) {
    if (last !== null && s - last <= stepMin * 60_000) {
      last = s;
      continue;
    }
    flush();
    first = s;
    last = s;
  }
  flush();
  return out;
}

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

  let prosQuery = supabase
    .from("professionals")
    .select("id, name, slot_step_min")
    .eq("salon_id", salon.id)
    .eq("active", true)
    .order("name");
  if (q.prof) prosQuery = prosQuery.eq("id", q.prof);
  const { data: pros } = await prosQuery.returns<Pro[]>();

  const { data: links } = await supabase
    .from("professional_services")
    .select("professional_id, service_id, duration_min, service:services(duration_min, active)")
    .in("professional_id", (pros ?? []).map((p) => p.id))
    .returns<{ professional_id: string; service_id: string; duration_min: number | null; service: { duration_min: number; active: boolean } | null }[]>();

  // Para cada profissional, usa o serviço mais curto para achar as faixas livres
  const perPro = await Promise.all(
    (pros ?? []).map(async (p) => {
      const opts = (links ?? [])
        .filter((l) => l.professional_id === p.id && l.service?.active)
        .map((l) => ({ id: l.service_id, dur: l.duration_min ?? l.service!.duration_min }))
        .sort((a, b) => a.dur - b.dur);
      if (!opts.length) return { pro: p, byDay: new Map<string, string[]>() };
      const { data } = await supabase.rpc("available_slots", {
        p_professional: p.id,
        p_service: opts[0].id,
        p_from: day,
        p_to: last,
      });
      const byDay = new Map<string, string[]>();
      const grouped = new Map<string, string[]>();
      for (const r of (data ?? []) as { starts_at: string }[]) {
        const k = dayKey(r.starts_at, tz);
        grouped.set(k, [...(grouped.get(k) ?? []), r.starts_at]);
      }
      for (const [k, list] of grouped) byDay.set(k, toRanges(list, p.slot_step_min, opts[0].dur, tz));
      return { pro: p, byDay };
    }),
  );

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
    const s = new URLSearchParams({ data: day, dias: String(days), ...(q.prof ? { prof: q.prof } : {}), ...p });
    return `/painel/agenda/livres?${s}`;
  };

  return (
    <main className="flex flex-col gap-4">
      <Link href="/painel/agenda" className="text-sm text-violet-600">‹ Agenda</Link>
      <h1 className="text-2xl font-bold">Horários livres</h1>
      <p className="text-sm text-neutral-500">
        Copie o texto e poste no status do WhatsApp, no Instagram ou mande para os clientes.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={qs({ data: addDays(day, -1) })} className="rounded-lg border border-neutral-300 px-3 py-1 dark:border-neutral-700">‹</Link>
        <span className="font-semibold first-letter:uppercase">
          {days === 1 ? shortDay(day) : `${shortDay(day)} a ${shortDay(last)}`}
        </span>
        <Link href={qs({ data: addDays(day, 1) })} className="rounded-lg border border-neutral-300 px-3 py-1 dark:border-neutral-700">›</Link>
        <Link href={qs({ dias: days === 1 ? "7" : "1" })} className="ml-auto rounded-lg border border-neutral-300 px-3 py-1 dark:border-neutral-700">
          {days === 1 ? "Ver 7 dias" : "Ver 1 dia"}
        </Link>
      </div>

      <Card>
        {hasAny ? (
          <pre className="whitespace-pre-wrap font-sans text-sm">{text}</pre>
        ) : (
          <p className="text-sm text-neutral-500">Nenhum horário livre nesse período.</p>
        )}
      </Card>

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

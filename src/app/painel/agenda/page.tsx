import Link from "next/link";
import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { DayStrip } from "@/components/day-strip";
import { Avatar, Notice } from "@/components/ui";
import { formatPrice, whatsappLink } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireSalon } from "@/lib/session";
import { addDays, dayKey, formatTime, isValidDay, shortDay, todayIn, weekdayOf, zonedToDate } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import { buildTimeline, fromMin, minutesInDay, toMin, type Busy } from "@/lib/timeline";
import { setStatus } from "./actions";

export const metadata = { title: "Agenda | Agenda Salão" };

type Row = {
  id: string;
  manage_token: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  notes: string | null;
  source: string;
  professional_id: string;
  client: { name: string | null; phone: string } | null;
  service: { name: string } | null;
  professional: { name: string } | null;
};

const STATUS: Record<AppointmentStatus, { label: string; bar: string; pill: string }> = {
  confirmed: {
    label: "Confirmado",
    bar: "bg-brand-400",
    pill: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200",
  },
  completed: {
    label: "Atendido",
    bar: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  no_show: {
    label: "Faltou",
    bar: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  cancelled: {
    label: "Desmarcado",
    bar: "bg-stone-300 dark:bg-stone-700",
    pill: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
  },
};

const SELECT =
  "id, manage_token, starts_at, ends_at, status, price_cents, notes, source, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)";
const NONE = "00000000-0000-0000-0000-000000000000";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; data?: string; prof?: string; erro?: string; ok?: string }>;
}) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;
  const today = todayIn(tz);
  const day = isValidDay(q.data) ? q.data : today;
  const month = q.view === "mes";
  // Funcionário sem permissão vê só a própria agenda e não vê valores.
  const onlyMine = !can(membership, "agenda_equipe");
  const showMoney = can(membership, "faturamento");
  const prof = onlyMine ? (membership.professional_id ?? NONE) : (q.prof ?? "");
  const mine = prof ? { professional_id: prof } : {};

  const href = (p: Partial<{ data: string; prof: string; mes: boolean }>) => {
    const s = new URLSearchParams({ data: p.data ?? day });
    const pr = p.prof ?? prof;
    if (pr && !onlyMine) s.set("prof", pr);
    if (p.mes) s.set("view", "mes");
    return `/painel/agenda?${s}`;
  };
  const returnTo = href({});

  // Faixa de dias: começa na segunda-feira da semana do dia escolhido
  const stripStart = addDays(day, -((weekdayOf(day) + 6) % 7));
  const monthFrom = `${day.slice(0, 7)}-01`;
  const monthTo = (() => {
    const d = new Date(`${monthFrom}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const countFrom = month ? monthFrom : stripStart;
  const countTo = month ? monthTo : addDays(stripStart, 14);
  const at = (d: string) => zonedToDate(d, "00:00", tz).toISOString();

  const [{ data: rows }, { data: pros }, { data: countRows }, { data: freed }] = await Promise.all([
    supabase
      .from("appointments")
      .select(SELECT)
      .eq("salon_id", salon.id)
      .gte("starts_at", at(day))
      .lt("starts_at", at(addDays(day, 1)))
      .match(mine)
      .order("starts_at")
      .returns<Row[]>(),
    supabase
      .from("professionals")
      .select("id, name, photo_url")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .order("name")
      .returns<{ id: string; name: string; photo_url: string | null }[]>(),
    supabase
      .from("appointments")
      .select("starts_at")
      .eq("salon_id", salon.id)
      .neq("status", "cancelled")
      .gte("starts_at", at(countFrom))
      .lt("starts_at", at(countTo))
      .match(mine)
      .returns<{ starts_at: string }[]>(),
    supabase
      .from("appointments")
      .select(SELECT)
      .eq("salon_id", salon.id)
      .eq("status", "cancelled")
      .match(mine)
      .gt("starts_at", new Date().toISOString())
      .gt("cancelled_at", new Date(Date.now() - 72 * 3_600_000).toISOString())
      .order("starts_at")
      .limit(10)
      .returns<Row[]>(),
  ]);

  const counts: Record<string, number> = {};
  for (const r of countRows ?? []) {
    const k = dayKey(r.starts_at, tz);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  const shownPros = (pros ?? []).filter((p) => !prof || p.id === prof);
  const proIds = shownPros.map((p) => p.id);
  const [{ data: hours }, { data: blocks }] =
    !month && proIds.length
      ? await Promise.all([
          supabase
            .from("working_hours")
            .select("professional_id, start_time, end_time")
            .in("professional_id", proIds)
            .eq("weekday", weekdayOf(day))
            .returns<{ professional_id: string; start_time: string; end_time: string }[]>(),
          supabase
            .from("time_blocks")
            .select("id, professional_id, starts_at, ends_at, reason")
            .in("professional_id", proIds)
            .lt("starts_at", at(addDays(day, 1)))
            .gt("ends_at", at(day))
            .returns<
              { id: string; professional_id: string; starts_at: string; ends_at: string; reason: string | null }[]
            >(),
        ])
      : [{ data: [] }, { data: [] }];

  const list = rows ?? [];
  const active = list.filter((r) => r.status !== "cancelled");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const salonUrl = `${proto}://${host}/${salon.slug}`;
  const nowMin = day === today ? minutesInDay(new Date().toISOString(), day, tz) : day < today ? 24 * 60 : 0;

  const dayTitle = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${monthFrom}T12:00:00Z`),
  );
  const shiftMonth = (dir: 1 | -1) => {
    const d = new Date(`${monthFrom}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + dir);
    return d.toISOString().slice(0, 10);
  };
  const rowProps = { tz, returnTo, salonName: salon.name, salonUrl, showMoney };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Topo: título e ações principais */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-semibold">Agenda</h1>
        <div className="flex gap-2">
          <Link
            href={month ? href({}) : href({ mes: true })}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium dark:border-stone-700"
          >
            {month ? "Ver dia" : "Mês"}
          </Link>
          <Link
            href={`/painel/agenda/novo?data=${day}${prof && !onlyMine ? `&prof=${prof}` : ""}`}
            className="rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-semibold text-white dark:bg-brand-300 dark:text-stone-950"
          >
            + Agendar
          </Link>
        </div>
      </div>

      {q.erro && <Notice kind="error">{q.erro}</Notice>}
      {q.ok && <Notice>Horário agendado.</Notice>}

      {/* Quem: filtro por profissional */}
      {!onlyMine && (pros ?? []).length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none]">
          {[{ id: "", name: "Toda a equipe", photo_url: null }, ...(pros ?? [])].map((p) => {
            const on = p.id === prof;
            return (
              <Link
                key={p.id}
                href={href({ prof: p.id })}
                replace
                className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition ${
                  on
                    ? "border-stone-900 bg-stone-900 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-stone-950"
                    : "border-stone-300 hover:border-stone-500 dark:border-stone-700"
                }`}
              >
                {p.id ? (
                  <Avatar name={p.name} src={p.photo_url} size={24} />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs text-stone-700 dark:bg-stone-700 dark:text-stone-200">
                    ✦
                  </span>
                )}
                {p.name}
              </Link>
            );
          })}
        </div>
      )}

      {month ? (
        /* Mês: calendário para escolher o dia */
        <section className="rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-2 flex items-center justify-between">
            <Link
              href={href({ data: shiftMonth(-1), mes: true })}
              className="rounded-lg px-3 py-1 text-xl"
              aria-label="Mês anterior"
            >
              ‹
            </Link>
            <p className="font-semibold first-letter:uppercase">{monthTitle}</p>
            <Link
              href={href({ data: shiftMonth(1), mes: true })}
              className="rounded-lg px-3 py-1 text-xl"
              aria-label="Próximo mês"
            >
              ›
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((w) => (
              <span key={w} className="py-1 text-stone-500">
                {w}
              </span>
            ))}
            {Array.from({ length: (weekdayOf(monthFrom) + 6) % 7 }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: Math.round((Date.parse(monthTo) - Date.parse(monthFrom)) / 86_400_000) }, (_, i) =>
              addDays(monthFrom, i),
            ).map((d) => {
              const n = counts[d] ?? 0;
              return (
                <Link
                  key={d}
                  href={href({ data: d })}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border ${
                    d === today ? "border-brand-500" : "border-transparent"
                  } ${n ? "bg-brand-50 dark:bg-brand-950" : "hover:bg-stone-100 dark:hover:bg-stone-800"} ${
                    d < today ? "opacity-50" : ""
                  }`}
                >
                  <span className="font-semibold">{Number(d.slice(8))}</span>
                  {n > 0 && <span className="text-[10px] text-brand-700 dark:text-brand-300">{n}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          {/* Quando: faixa de dias */}
          <div className="flex items-center gap-1">
            <Link
              href={href({ data: addDays(stripStart, -7) })}
              className="hidden rounded-lg px-2 py-1 text-xl text-stone-500 sm:block"
              aria-label="Semana anterior"
            >
              ‹
            </Link>
            <div className="min-w-0 flex-1">
              <DayStrip
                start={stripStart}
                selected={day}
                today={today}
                counts={counts}
                href={(d) => href({ data: d })}
              />
            </div>
            <Link
              href={href({ data: addDays(stripStart, 14) })}
              className="hidden rounded-lg px-2 py-1 text-xl text-stone-500 sm:block"
              aria-label="Próximas semanas"
            >
              ›
            </Link>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold first-letter:uppercase">{dayTitle}</h2>
              <p className="text-xs text-stone-500">
                {active.length} horário{active.length === 1 ? "" : "s"}
                {showMoney && active.length > 0
                  ? ` · ${formatPrice(active.filter((r) => r.status !== "no_show").reduce((s, r) => s + r.price_cents, 0))} previsto`
                  : ""}
              </p>
            </div>
            {day !== today && (
              <Link href={href({ data: today })} className="text-sm font-medium text-brand-700 dark:text-brand-300">
                Ir para hoje
              </Link>
            )}
          </div>

          {/* O dia de cada profissional */}
          <div className="flex flex-col gap-5">
            {shownPros.map((p) => {
              type Ref = Row | { reason: string | null };
              const periods = (hours ?? [])
                .filter((x) => x.professional_id === p.id)
                .map((x) => ({ start: toMin(x.start_time), end: toMin(x.end_time) }));
              const busy: Busy<Ref>[] = [
                ...list
                  .filter((r) => r.professional_id === p.id && r.status !== "cancelled")
                  .map((r) => ({
                    kind: "appt" as const,
                    start: minutesInDay(r.starts_at, day, tz),
                    end: minutesInDay(r.ends_at, day, tz),
                    ref: r,
                  })),
                ...(blocks ?? [])
                  .filter((b) => b.professional_id === p.id)
                  .map((b) => ({
                    kind: "block" as const,
                    start: minutesInDay(b.starts_at, day, tz),
                    end: minutesInDay(b.ends_at, day, tz),
                    ref: { reason: b.reason },
                  })),
              ];
              const segs = buildTimeline(periods, busy)
                .map((s) => (s.kind === "free" && s.start < nowMin ? { ...s, start: Math.ceil(nowMin / 15) * 15 } : s))
                .filter((s) => s.kind !== "free" || s.end - s.start >= 15);
              const cancelled = list.filter((r) => r.professional_id === p.id && r.status === "cancelled");
              const worked = periods.map((x) => `${fromMin(x.start)}–${fromMin(x.end)}`).join(" e ");
              const count = busy.filter((b) => b.kind === "appt").length;
              // Na visão da equipe toda, quem está de folga e sem horários fica de fora
              if (!prof && !periods.length && !count && !cancelled.length) return null;
              return (
                <section key={p.id} className="flex flex-col gap-2">
                  {onlyMine ? (
                    <p className="text-xs text-stone-500">{worked ? `Seu expediente: ${worked}` : "Folga neste dia"}</p>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} src={p.photo_url} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{p.name}</p>
                        <p className="text-xs text-stone-500">
                          {worked ? `${count} horário${count === 1 ? "" : "s"} · ${worked}` : "Folga neste dia"}
                        </p>
                      </div>
                    </div>
                  )}
                  <ol className="flex flex-col gap-1.5">
                    {segs.map((s) =>
                      s.kind === "appt" ? (
                        <AppointmentRow key={(s.ref as Row).id} r={s.ref as Row} {...rowProps} />
                      ) : s.kind === "block" ? (
                        <li
                          key={`b${s.start}`}
                          className="flex items-center gap-3 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-500 dark:bg-stone-900"
                        >
                          <span className="w-12 font-mono tabular-nums">{fromMin(s.start)}</span>
                          <span>
                            Bloqueado até {fromMin(Math.min(s.end, 1439))}
                            {(s.ref as { reason: string | null }).reason
                              ? ` · ${(s.ref as { reason: string | null }).reason}`
                              : ""}
                          </span>
                        </li>
                      ) : (
                        <li key={`f${s.start}`}>
                          <Link
                            href={`/painel/agenda/novo?data=${day}&prof=${p.id}&hora=${fromMin(s.start)}`}
                            className="flex items-center gap-3 rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-stone-700 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                          >
                            <span className="w-12 font-mono tabular-nums">{fromMin(s.start)}</span>
                            <span className="flex-1">Livre até {fromMin(s.end)}</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">+ Agendar</span>
                          </Link>
                        </li>
                      ),
                    )}
                    {segs.length === 0 && (
                      <li className="rounded-xl bg-stone-100 px-3 py-3 text-center text-sm text-stone-500 dark:bg-stone-900">
                        {periods.length ? "Sem horários livres restantes." : "Não atende neste dia."}
                      </li>
                    )}
                  </ol>
                  {cancelled.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer list-none text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
                        {cancelled.length} desmarcado{cancelled.length === 1 ? "" : "s"} neste dia ›
                      </summary>
                      <ol className="mt-1.5 flex flex-col gap-1.5">
                        {cancelled.map((r) => (
                          <AppointmentRow key={r.id} r={r} {...rowProps} />
                        ))}
                      </ol>
                    </details>
                  )}
                </section>
              );
            })}
            {/* horários de profissionais que não estão na lista (ex.: excluídos) */}
            {list.some((r) => !proIds.includes(r.professional_id)) && (
              <ol className="flex flex-col gap-1.5">
                {list
                  .filter((r) => !proIds.includes(r.professional_id))
                  .map((r) => (
                    <AppointmentRow key={r.id} r={r} {...rowProps} showPro />
                  ))}
              </ol>
            )}
          </div>
        </>
      )}

      {/* Vagas que clientes liberaram */}
      {(freed ?? []).length > 0 && (
        <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <summary className="cursor-pointer list-none font-medium text-amber-900 dark:text-amber-200">
            {(freed ?? []).length} vaga(s) liberada(s) por clientes. Toque para divulgar ›
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {(freed ?? []).map((f) => {
              const text = `Vagou um horário! ${shortDay(dayKey(f.starts_at, tz))} às ${formatTime(f.starts_at, tz)} com ${f.professional?.name}. Agende pelo link: ${salonUrl}/agendar`;
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <b>
                      {shortDay(dayKey(f.starts_at, tz))} {formatTime(f.starts_at, tz)}
                    </b>{" "}
                    · {f.professional?.name} · {f.service?.name}
                  </span>
                  <CopyButton text={text} label="Copiar aviso" />
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <Link
        href={`/painel/agenda/livres?data=${day}${prof && !onlyMine ? `&prof=${prof}` : ""}`}
        className="self-center text-sm text-stone-500 underline-offset-4 hover:underline"
      >
        Ver lista de horários livres para enviar a clientes
      </Link>
    </main>
  );
}

/** Uma linha por horário. Toque para abrir as ações (WhatsApp, atendido, faltou...). */
function AppointmentRow({
  r,
  tz,
  returnTo,
  salonName,
  salonUrl,
  showMoney,
  showPro = false,
}: {
  r: Row;
  tz: string;
  returnTo: string;
  salonName: string;
  salonUrl: string;
  showMoney: boolean;
  showPro?: boolean;
}) {
  const st = STATUS[r.status];
  const name = r.client?.name ?? "Cliente";
  const action = (status: AppointmentStatus, label: string, cls = "") => (
    <form action={setStatus}>
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        className={`rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-stone-700 dark:bg-stone-900 ${cls}`}
      >
        {label}
      </button>
    </form>
  );

  return (
    <li>
      <details
        className={`group overflow-hidden rounded-xl border border-stone-200 bg-white open:shadow-sm dark:border-stone-800 dark:bg-stone-900 ${
          r.status === "cancelled" ? "opacity-60" : ""
        }`}
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 pr-3">
          <span className={`w-1 self-stretch rounded-r-full ${st.bar}`} aria-hidden />
          <span className="w-12 shrink-0 font-mono text-sm font-semibold tabular-nums">
            {formatTime(r.starts_at, tz)}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${r.status === "cancelled" ? "line-through" : ""}`}>
              {name}
            </span>
            <span className="block truncate text-xs text-stone-500">
              {r.service?.name} · até {formatTime(r.ends_at, tz)}
              {showPro ? ` · ${r.professional?.name}` : ""}
            </span>
          </span>
          {r.status !== "confirmed" && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${st.pill}`}>{st.label}</span>
          )}
          <span className="text-stone-400 transition group-open:rotate-90" aria-hidden>
            ›
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50 px-4 py-3 dark:border-stone-800 dark:bg-stone-950/40">
          <p className="text-xs text-stone-500">
            {r.professional?.name}
            {showMoney ? ` · ${formatPrice(r.price_cents)}` : ""}
            {r.source === "salon" ? " · marcado no salão" : " · marcado pelo cliente"}
            {r.notes ? ` · Obs.: ${r.notes}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.client?.phone && (
              <a
                href={whatsappLink(
                  r.client.phone,
                  `Olá ${name}! Passando para lembrar do seu horário de ${r.service?.name} às ${formatTime(r.starts_at, tz)} no ${salonName}. Te esperamos!`,
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#1f9d55] px-3 py-1.5 text-xs font-semibold text-white"
              >
                WhatsApp
              </a>
            )}
            {r.status === "confirmed" && (
              <>
                {action("completed", "✓ Atendido", "text-emerald-700 dark:text-emerald-300")}
                {action("no_show", "Faltou")}
                {action("cancelled", "Desmarcar", "text-red-600")}
              </>
            )}
            {r.status === "completed" && r.client?.phone && (
              <a
                href={whatsappLink(
                  r.client.phone,
                  `Olá ${name}! Obrigado pela visita no ${salonName}. Pode avaliar seu atendimento? Leva 10 segundos: ${salonUrl}/agendamento/${r.manage_token}#avaliar`,
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400"
              >
                ★ Pedir avaliação
              </a>
            )}
            {(r.status === "completed" || r.status === "no_show") && action("confirmed", "Desfazer")}
          </div>
        </div>
      </details>
    </li>
  );
}

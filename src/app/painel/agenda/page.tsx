import Link from "next/link";
import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { Card, Notice } from "@/components/ui";
import { formatPrice, whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";
import {
  addDays,
  dayKey,
  formatTime,
  isValidDay,
  shortDay,
  todayIn,
  weekdayOf,
  zonedToDate,
} from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import { buildTimeline, fromMin, minutesInDay, toMin, type Busy } from "@/lib/timeline";
import { setStatus } from "./actions";

export const metadata = { title: "Agenda | Agenda Salão" };

type View = "dia" | "semana" | "mes";

type Row = {
  id: string;
  manage_token: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  notes: string | null;
  source: string;
  cancelled_at: string | null;
  professional_id: string;
  client: { name: string | null; phone: string } | null;
  service: { name: string } | null;
  professional: { name: string } | null;
};

const STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmado", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200" },
  completed: { label: "Atendido", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  no_show: { label: "Faltou", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  cancelled: { label: "Desmarcado", cls: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400" },
};

function range(view: View, day: string) {
  if (view === "dia") return { from: day, to: addDays(day, 1) };
  if (view === "semana") {
    const start = addDays(day, -((weekdayOf(day) + 6) % 7)); // segunda
    return { from: start, to: addDays(start, 7) };
  }
  const first = `${day.slice(0, 7)}-01`;
  const next = new Date(`${first}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from: first, to: next.toISOString().slice(0, 10) };
}

function shift(view: View, day: string, dir: 1 | -1) {
  if (view === "dia") return addDays(day, dir);
  if (view === "semana") return addDays(day, 7 * dir);
  const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; data?: string; prof?: string; erro?: string; ok?: string }>;
}) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;
  const view: View = q.view === "semana" || q.view === "mes" ? q.view : "dia";
  const today = todayIn(tz);
  const day = isValidDay(q.data) ? q.data : today;
  const prof = q.prof ?? (membership.role === "professional" ? membership.professional_id ?? "" : "");
  const { from, to } = range(view, day);

  const href = (p: Partial<{ view: View; data: string; prof: string }>) => {
    const s = new URLSearchParams({ view: p.view ?? view, data: p.data ?? day });
    const pr = p.prof ?? prof;
    if (pr) s.set("prof", pr);
    return `/painel/agenda?${s}`;
  };
  const returnTo = href({});

  let query = supabase
    .from("appointments")
    .select(
      "id, manage_token, starts_at, ends_at, status, price_cents, notes, source, cancelled_at, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)",
    )
    .eq("salon_id", salon.id)
    .gte("starts_at", zonedToDate(from, "00:00", tz).toISOString())
    .lt("starts_at", zonedToDate(to, "00:00", tz).toISOString())
    .order("starts_at");
  if (prof) query = query.eq("professional_id", prof);

  const [{ data: rows }, { data: pros }, { data: freed }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.from("professionals").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
    supabase
      .from("appointments")
      .select("id, manage_token, starts_at, ends_at, status, price_cents, notes, source, cancelled_at, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)")
      .eq("salon_id", salon.id)
      .eq("status", "cancelled")
      .gt("starts_at", new Date().toISOString())
      .gt("cancelled_at", new Date(Date.now() - 72 * 3_600_000).toISOString())
      .order("starts_at")
      .limit(10)
      .returns<Row[]>(),
  ]);

  // Expediente e bloqueios do dia (para mostrar as janelas livres de cada profissional)
  const shownPros = (pros ?? []).filter((p) => !prof || p.id === prof);
  const [{ data: hours }, { data: blocks }] =
    view === "dia" && shownPros.length
      ? await Promise.all([
          supabase
            .from("working_hours")
            .select("professional_id, start_time, end_time")
            .in("professional_id", shownPros.map((p) => p.id))
            .eq("weekday", weekdayOf(day))
            .returns<{ professional_id: string; start_time: string; end_time: string }[]>(),
          supabase
            .from("time_blocks")
            .select("id, professional_id, starts_at, ends_at, reason")
            .in("professional_id", shownPros.map((p) => p.id))
            .lt("starts_at", zonedToDate(to, "00:00", tz).toISOString())
            .gt("ends_at", zonedToDate(from, "00:00", tz).toISOString())
            .returns<{ id: string; professional_id: string; starts_at: string; ends_at: string; reason: string | null }[]>(),
        ])
      : [{ data: [] }, { data: [] }];

  const list = rows ?? [];
  const active = list.filter((r) => r.status !== "cancelled");
  const byDay = new Map<string, Row[]>();
  for (const r of list) {
    const k = dayKey(r.starts_at, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const bookingLink = `${proto}://${host}/${salon.slug}/agendar`;

  const title =
    view === "dia"
      ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
          new Date(`${day}T12:00:00Z`),
        )
      : view === "semana"
        ? `${shortDay(from)} a ${shortDay(addDays(to, -1))}`
        : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(`${from}T12:00:00Z`),
          );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-semibold">Agenda</h1>
        <div className="flex gap-2">
          <Link href={`/painel/agenda/livres?data=${day}${prof ? `&prof=${prof}` : ""}`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-700">
            Horários livres
          </Link>
          <Link href={`/painel/agenda/novo?data=${day}${prof ? `&prof=${prof}` : ""}`} className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-stone-100 dark:text-stone-900">
            + Agendar
          </Link>
        </div>
      </div>

      {q.erro && <Notice kind="error">{q.erro}</Notice>}
      {q.ok && <Notice>Horário agendado.</Notice>}

      {/* Vagas liberadas */}
      {(freed ?? []).length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="font-display text-lg font-semibold">Vagas liberadas recentemente</h2>
          <p className="mb-2 text-xs text-stone-600 dark:text-stone-400">
            Clientes desmarcaram estes horários. Divulgue para preencher!
          </p>
          <ul className="flex flex-col gap-2">
            {(freed ?? []).map((f) => {
              const text = `Vagou um horário! ${shortDay(dayKey(f.starts_at, tz))} às ${formatTime(f.starts_at, tz)} com ${f.professional?.name}. Agende pelo link: ${bookingLink}`;
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <b>{shortDay(dayKey(f.starts_at, tz))} {formatTime(f.starts_at, tz)}</b> · {f.professional?.name} ·{" "}
                    {f.service?.name}
                  </span>
                  <CopyButton text={text} label="Copiar aviso" />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Navegação */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 rounded-lg bg-stone-200 p-1 text-center text-sm font-medium dark:bg-stone-800">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <Link key={v} href={href({ view: v })} className={`rounded-md py-1.5 ${v === view ? "bg-white shadow dark:bg-stone-950" : ""}`}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Link href={href({ data: shift(view, day, -1) })} className="rounded-lg px-3 py-1 text-xl" aria-label="Anterior">‹</Link>
          <div className="text-center">
            <p className="font-semibold first-letter:uppercase">{title}</p>
            {day !== today && (
              <Link href={href({ data: today })} className="text-xs text-brand-700 dark:text-brand-300">Ir para hoje</Link>
            )}
          </div>
          <Link href={href({ data: shift(view, day, 1) })} className="rounded-lg px-3 py-1 text-xl" aria-label="Próximo">›</Link>
        </div>
        {(pros ?? []).length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm">
            {[{ id: "", name: "Todos" }, ...(pros ?? [])].map((p) => (
              <Link
                key={p.id}
                href={href({ prof: p.id })}
                className={`shrink-0 rounded-full border px-3 py-1 ${
                  p.id === prof ? "border-stone-900 bg-stone-900 dark:border-stone-100 text-white dark:bg-stone-100 dark:text-stone-900" : "border-stone-300 dark:border-stone-700"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-500">
          {active.length} horário(s) · {formatPrice(active.reduce((s, r) => s + r.price_cents, 0))} previsto
        </p>
      </div>

      {view === "dia" && (
        <div className="flex flex-col gap-4">
          {shownPros.map((p) => {
            type Ref = Row | { reason: string | null };
            const periods = (hours ?? [])
              .filter((h) => h.professional_id === p.id)
              .map((h) => ({ start: toMin(h.start_time), end: toMin(h.end_time) }));
            const busy: Busy<Ref>[] = [
              ...list
                .filter((r) => r.professional_id === p.id && r.status !== "cancelled")
                .map((r) => ({ kind: "appt" as const, start: minutesInDay(r.starts_at, day, tz), end: minutesInDay(r.ends_at, day, tz), ref: r })),
              ...(blocks ?? [])
                .filter((b) => b.professional_id === p.id)
                .map((b) => ({ kind: "block" as const, start: minutesInDay(b.starts_at, day, tz), end: minutesInDay(b.ends_at, day, tz), ref: { reason: b.reason } })),
            ];
            // horário livre que já passou não interessa
            const nowMin = day === today ? minutesInDay(new Date().toISOString(), day, tz) : day < today ? 24 * 60 : 0;
            const segs = buildTimeline(periods, busy)
              .map((s) => (s.kind === "free" && s.start < nowMin ? { ...s, start: Math.ceil(nowMin / 15) * 15 } : s))
              .filter((s) => s.kind !== "free" || s.end - s.start >= 15);
            const cancelled = list.filter((r) => r.professional_id === p.id && r.status === "cancelled");
            const worked = periods.map((x) => `${fromMin(x.start)}–${fromMin(x.end)}`).join(" e ");
            return (
              <section key={p.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">{p.name}</h2>
                  <span className="text-xs text-stone-500">{worked ? `Expediente ${worked}` : "Folga neste dia"}</span>
                </div>
                {segs.length === 0 && (
                  <p className="text-sm text-stone-500">{periods.length ? "Sem horários livres restantes." : "Não atende neste dia."}</p>
                )}
                <ul className="flex flex-col gap-2">
                  {segs.map((s) =>
                    s.kind === "appt" ? (
                      <AppointmentCard key={(s.ref as Row).id} r={s.ref as Row} tz={tz} returnTo={returnTo} salonName={salon.name} salonUrl={`${proto}://${host}/${salon.slug}`} />
                    ) : s.kind === "block" ? (
                      <li key={`b${s.start}`} className="rounded-xl border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500 dark:border-stone-700">
                        <span className="font-mono">{fromMin(s.start)}–{fromMin(Math.min(s.end, 1439))}</span> · Bloqueado
                        {(s.ref as { reason: string | null }).reason ? ` (${(s.ref as { reason: string | null }).reason})` : ""}
                      </li>
                    ) : (
                      <li key={`f${s.start}`}>
                        <Link
                          href={`/painel/agenda/novo?data=${day}&prof=${p.id}&hora=${fromMin(s.start)}`}
                          className="flex items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-2.5 text-sm text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        >
                          <span>
                            <span className="font-mono">{fromMin(s.start)}–{fromMin(s.end)}</span> · Livre
                          </span>
                          <span className="font-semibold">+ Agendar</span>
                        </Link>
                      </li>
                    ),
                  )}
                  {cancelled.map((r) => (
                    <AppointmentCard key={r.id} r={r} tz={tz} returnTo={returnTo} salonName={salon.name} salonUrl={`${proto}://${host}/${salon.slug}`} />
                  ))}
                </ul>
              </section>
            );
          })}
          {/* horários de profissionais que não estão na lista (ex.: excluídos) */}
          {list.filter((r) => !shownPros.some((p) => p.id === r.professional_id)).length > 0 && (
            <ul className="flex flex-col gap-2">
              {list
                .filter((r) => !shownPros.some((p) => p.id === r.professional_id))
                .map((r) => (
                  <AppointmentCard key={r.id} r={r} tz={tz} returnTo={returnTo} salonName={salon.name} salonUrl={`${proto}://${host}/${salon.slug}`} />
                ))}
            </ul>
          )}
        </div>
      )}

      {view === "semana" && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
            const items = (byDay.get(d) ?? []).filter((r) => r.status !== "cancelled");
            return (
              <Card key={d} className={d === today ? "border-brand-400" : ""}>
                <Link href={href({ view: "dia", data: d })} className="flex items-center justify-between">
                  <span className="font-semibold first-letter:uppercase">{shortDay(d)}</span>
                  <span className="text-xs text-stone-500">{items.length} horário(s) ›</span>
                </Link>
                {items.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {items.map((r) => (
                      <li key={r.id} className="flex gap-2">
                        <span className="w-12 font-mono">{formatTime(r.starts_at, tz)}</span>
                        <span className="flex-1 truncate">
                          {r.client?.name ?? r.client?.phone} · {r.service?.name}
                          {!prof && <span className="text-stone-500"> · {r.professional?.name}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {view === "mes" && (
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((w) => (
            <span key={w} className="py-1 text-stone-500">{w}</span>
          ))}
          {Array.from({ length: (weekdayOf(from) + 6) % 7 }, (_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) }, (_, i) => addDays(from, i)).map((d) => {
            const n = (byDay.get(d) ?? []).filter((r) => r.status !== "cancelled").length;
            return (
              <Link
                key={d}
                href={href({ view: "dia", data: d })}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border ${
                  d === today ? "border-brand-500" : "border-stone-200 dark:border-stone-800"
                } ${n ? "bg-brand-50 dark:bg-brand-950" : "bg-white dark:bg-stone-900"}`}
              >
                <span className="font-semibold">{Number(d.slice(8))}</span>
                {n > 0 && <span className="text-[10px] text-brand-700 dark:text-brand-300">{n}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function AppointmentCard({ r, tz, returnTo, salonName, salonUrl }: { r: Row; tz: string; returnTo: string; salonName: string; salonUrl: string }) {
  const st = STATUS[r.status];
  const name = r.client?.name ?? "Cliente";
  const remind = whatsappLink(
    r.client?.phone,
    `Olá ${name}! Passando para lembrar do seu horário de ${r.service?.name} hoje às ${formatTime(r.starts_at, tz)} no ${salonName}. Te esperamos!`,
  );
  const action = (status: AppointmentStatus, label: string, cls = "") => (
    <form action={setStatus}>
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button className={`rounded-lg border border-stone-300 px-2.5 py-1 text-xs dark:border-stone-700 ${cls}`}>{label}</button>
    </form>
  );

  return (
    <li>
      <Card className={r.status === "cancelled" ? "opacity-60" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm">
              {formatTime(r.starts_at, tz)}–{formatTime(r.ends_at, tz)}
            </p>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-stone-500">
              {r.service?.name} · {r.professional?.name} · {formatPrice(r.price_cents)}
              {r.source === "salon" ? " · balcão" : ""}
            </p>
            {r.notes && <p className="text-xs text-stone-500">Obs.: {r.notes}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.client?.phone && (
            <a href={remind} target="_blank" rel="noreferrer" className="rounded-lg border border-green-600 px-2.5 py-1 text-xs text-green-700 dark:text-green-400">
              WhatsApp
            </a>
          )}
          {r.status === "confirmed" && (
            <>
              {action("completed", "Atendido")}
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
              className="rounded-lg border border-amber-500 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-400"
            >
              ★ Pedir avaliação
            </a>
          )}
          {(r.status === "completed" || r.status === "no_show") && action("confirmed", "Desfazer")}
        </div>
      </Card>
    </li>
  );
}

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
import { setStatus } from "./actions";

export const metadata = { title: "Agenda | Agenda Salão" };

type View = "dia" | "semana" | "mes";

type Row = {
  id: string;
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
  confirmed: { label: "Confirmado", cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  completed: { label: "Atendido", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  no_show: { label: "Faltou", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  cancelled: { label: "Desmarcado", cls: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
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
      "id, starts_at, ends_at, status, price_cents, notes, source, cancelled_at, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)",
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
      .select("id, starts_at, ends_at, status, price_cents, notes, source, cancelled_at, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)")
      .eq("salon_id", salon.id)
      .eq("status", "cancelled")
      .gt("starts_at", new Date().toISOString())
      .gt("cancelled_at", new Date(Date.now() - 72 * 3_600_000).toISOString())
      .order("starts_at")
      .limit(10)
      .returns<Row[]>(),
  ]);

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
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex gap-2">
          <Link href={`/painel/agenda/livres?data=${day}${prof ? `&prof=${prof}` : ""}`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            Horários livres
          </Link>
          <Link href={`/painel/agenda/novo?data=${day}${prof ? `&prof=${prof}` : ""}`} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white">
            + Agendar
          </Link>
        </div>
      </div>

      {q.erro && <Notice kind="error">{q.erro}</Notice>}
      {q.ok && <Notice>Horário agendado.</Notice>}

      {/* Vagas liberadas */}
      {(freed ?? []).length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="font-semibold">Vagas liberadas recentemente</h2>
          <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
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
        <div className="grid grid-cols-3 rounded-lg bg-neutral-200 p-1 text-center text-sm font-medium dark:bg-neutral-800">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <Link key={v} href={href({ view: v })} className={`rounded-md py-1.5 ${v === view ? "bg-white shadow dark:bg-neutral-950" : ""}`}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Link href={href({ data: shift(view, day, -1) })} className="rounded-lg px-3 py-1 text-xl" aria-label="Anterior">‹</Link>
          <div className="text-center">
            <p className="font-semibold first-letter:uppercase">{title}</p>
            {day !== today && (
              <Link href={href({ data: today })} className="text-xs text-violet-600">Ir para hoje</Link>
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
                  p.id === prof ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-neutral-500">
          {active.length} horário(s) · {formatPrice(active.reduce((s, r) => s + r.price_cents, 0))} previsto
        </p>
      </div>

      {view === "dia" && (
        list.length ? (
          <ul className="flex flex-col gap-2">
            {list.map((r) => (
              <AppointmentCard key={r.id} r={r} tz={tz} returnTo={returnTo} salonName={salon.name} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Nenhum horário neste dia.</p>
        )
      )}

      {view === "semana" && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
            const items = (byDay.get(d) ?? []).filter((r) => r.status !== "cancelled");
            return (
              <Card key={d} className={d === today ? "border-violet-400" : ""}>
                <Link href={href({ view: "dia", data: d })} className="flex items-center justify-between">
                  <span className="font-semibold first-letter:uppercase">{shortDay(d)}</span>
                  <span className="text-xs text-neutral-500">{items.length} horário(s) ›</span>
                </Link>
                {items.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {items.map((r) => (
                      <li key={r.id} className="flex gap-2">
                        <span className="w-12 font-mono">{formatTime(r.starts_at, tz)}</span>
                        <span className="flex-1 truncate">
                          {r.client?.name ?? r.client?.phone} · {r.service?.name}
                          {!prof && <span className="text-neutral-500"> · {r.professional?.name}</span>}
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
            <span key={w} className="py-1 text-neutral-500">{w}</span>
          ))}
          {Array.from({ length: (weekdayOf(from) + 6) % 7 }, (_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) }, (_, i) => addDays(from, i)).map((d) => {
            const n = (byDay.get(d) ?? []).filter((r) => r.status !== "cancelled").length;
            return (
              <Link
                key={d}
                href={href({ view: "dia", data: d })}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border ${
                  d === today ? "border-violet-500" : "border-neutral-200 dark:border-neutral-800"
                } ${n ? "bg-violet-50 dark:bg-violet-950" : "bg-white dark:bg-neutral-900"}`}
              >
                <span className="font-semibold">{Number(d.slice(8))}</span>
                {n > 0 && <span className="text-[10px] text-violet-700 dark:text-violet-300">{n}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function AppointmentCard({ r, tz, returnTo, salonName }: { r: Row; tz: string; returnTo: string; salonName: string }) {
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
      <button className={`rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700 ${cls}`}>{label}</button>
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
            <p className="text-sm text-neutral-500">
              {r.service?.name} · {r.professional?.name} · {formatPrice(r.price_cents)}
              {r.source === "salon" ? " · balcão" : ""}
            </p>
            {r.notes && <p className="text-xs text-neutral-500">Obs.: {r.notes}</p>}
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
          {(r.status === "completed" || r.status === "no_show") && action("confirmed", "Desfazer")}
        </div>
      </Card>
    </li>
  );
}

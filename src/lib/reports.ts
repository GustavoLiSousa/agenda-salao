import type { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/session";
import { can } from "@/lib/permissions";
import { leadStatus, type ClientStats } from "@/lib/clients";
import { addDays, dayKey, isValidDay, todayIn, zonedToDate } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

export const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "ano", label: "Este ano" },
  { key: "personalizado", label: "Escolher datas" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export type ReportQuery = { p?: string; de?: string; ate?: string };

const monthEnd = (day: string) => addDays(`${addDays(`${day.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Período escolhido (datas inclusivas) e o período anterior para comparar. */
export function resolvePeriod(q: ReportQuery, tz: string) {
  const today = todayIn(tz);
  let key = (PERIODS.some((p) => p.key === q.p) ? q.p : "mes") as PeriodKey;
  let from = today;
  let to = today;
  let prevFrom: string;
  let prevTo: string;
  if (key === "personalizado" && isValidDay(q.de) && isValidDay(q.ate)) {
    from = q.de <= q.ate ? q.de : q.ate;
    to = q.de <= q.ate ? q.ate : q.de;
    if (daysBetween(from, to) > 400) from = addDays(to, -400);
  } else if (key === "personalizado") {
    key = "mes";
  }
  if (key === "hoje") {
    prevFrom = prevTo = addDays(today, -1);
  } else if (key === "semana") {
    const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // segunda = 0
    from = addDays(today, -wd);
    prevFrom = addDays(from, -7);
    prevTo = addDays(today, -7);
  } else if (key === "mes") {
    from = `${today.slice(0, 7)}-01`;
    prevFrom = `${addDays(from, -1).slice(0, 7)}-01`;
    const sameDay = `${prevFrom.slice(0, 8)}${today.slice(8)}`;
    prevTo = sameDay > monthEnd(prevFrom) || !isValidDay(sameDay) ? monthEnd(prevFrom) : sameDay;
  } else if (key === "mes_passado") {
    from = `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    to = monthEnd(from);
    prevFrom = `${addDays(from, -1).slice(0, 7)}-01`;
    prevTo = monthEnd(prevFrom);
  } else if (key === "ano") {
    from = `${today.slice(0, 4)}-01-01`;
    prevFrom = `${Number(today.slice(0, 4)) - 1}-01-01`;
    prevTo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  } else {
    const len = daysBetween(from, to);
    prevTo = addDays(from, -1);
    prevFrom = addDays(prevTo, -len);
  }
  return { key, from, to, prevFrom: prevFrom!, prevTo: prevTo!, today };
}

type ApptRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  professional_id: string;
  client_id: string;
  service_id: string;
  service: { name: string } | null;
  professional: { name: string } | null;
  client: { name: string | null; phone: string } | null;
};
type PkgRow = {
  id: string;
  name: string;
  price_cents: number;
  purchased_at: string;
  client_id: string;
  client: { name: string | null; phone: string } | null;
};

export type ReportAppt = ApptRow & { done: boolean; byPackage: boolean; day: string };

async function packageApptIds(supabase: Supa, ids: string[]) {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from("package_uses")
      .select("appointment_id")
      .in("appointment_id", ids.slice(i, i + 300))
      .is("undone_at", null)
      .returns<{ appointment_id: string }[]>();
    for (const r of data ?? []) out.add(r.appointment_id);
  }
  return out;
}

/** Carrega e calcula tudo o que a tela de Relatórios (e a planilha) mostram. */
export async function loadReport(supabase: Supa, membership: Membership, q: ReportQuery) {
  const salon = membership.salon;
  const tz = salon.timezone;
  const period = resolvePeriod(q, tz);
  const onlyMine = !can(membership, "agenda_equipe");
  const showMoney = can(membership, "faturamento");
  const owner = membership.role === "owner";
  const mine: Record<string, string> = onlyMine
    ? { professional_id: membership.professional_id ?? "00000000-0000-0000-0000-000000000000" }
    : {};
  const iso = (d: string) => zonedToDate(d, "00:00", tz).toISOString();
  const nowIso = new Date().toISOString();

  const apptSelect =
    "id, starts_at, ends_at, status, price_cents, professional_id, client_id, service_id, service:services(name), professional:professionals(name), client:clients(name, phone)";
  const pkgSelect = "id, name, price_cents, purchased_at, client_id, client:clients(name, phone)";

  const [{ data: cur }, { data: prev }, { data: pkgs }, { data: prevPkgs }, { data: commissions }, { data: stats }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(apptSelect)
        .eq("salon_id", salon.id)
        .gte("starts_at", iso(period.from))
        .lt("starts_at", iso(addDays(period.to, 1)))
        .match(mine)
        .order("starts_at")
        .limit(5000)
        .returns<ApptRow[]>(),
      supabase
        .from("appointments")
        .select("id, status, price_cents, ends_at")
        .eq("salon_id", salon.id)
        .gte("starts_at", iso(period.prevFrom))
        .lt("starts_at", iso(addDays(period.prevTo, 1)))
        .match(mine)
        .limit(5000)
        .returns<{ id: string; status: AppointmentStatus; price_cents: number; ends_at: string }[]>(),
      onlyMine
        ? Promise.resolve({ data: [] as PkgRow[] })
        : supabase
            .from("client_packages")
            .select(pkgSelect)
            .eq("salon_id", salon.id)
            .neq("status", "cancelled")
            .gte("purchased_at", iso(period.from))
            .lt("purchased_at", iso(addDays(period.to, 1)))
            .order("purchased_at")
            .returns<PkgRow[]>(),
      onlyMine
        ? Promise.resolve({ data: [] as { price_cents: number }[] })
        : supabase
            .from("client_packages")
            .select("price_cents")
            .eq("salon_id", salon.id)
            .neq("status", "cancelled")
            .gte("purchased_at", iso(period.prevFrom))
            .lt("purchased_at", iso(addDays(period.prevTo, 1)))
            .returns<{ price_cents: number }[]>(),
      supabase
        .from("professional_commissions")
        .select("professional_id, pct")
        .eq("salon_id", salon.id)
        .returns<{ professional_id: string; pct: number }[]>(),
      onlyMine
        ? Promise.resolve({ data: [] as ClientStats[] })
        : supabase.from("client_stats").select("*").eq("salon_id", salon.id).returns<ClientStats[]>(),
    ]);

  const isDone = (r: { status: AppointmentStatus; ends_at: string }) =>
    r.status === "completed" || (r.status === "confirmed" && r.ends_at < nowIso);

  const curRows = cur ?? [];
  const prevRows = prev ?? [];
  const [pkgIds, prevPkgIds] = await Promise.all([
    packageApptIds(
      supabase,
      curRows.filter(isDone).map((r) => r.id),
    ),
    packageApptIds(
      supabase,
      prevRows.filter(isDone).map((r) => r.id),
    ),
  ]);

  const appts: ReportAppt[] = curRows.map((r) => ({
    ...r,
    done: isDone(r),
    byPackage: pkgIds.has(r.id),
    day: dayKey(r.starts_at, tz),
  }));
  const done = appts.filter((r) => r.done);
  const paid = done.filter((r) => !r.byPackage);
  const servicesCents = paid.reduce((s, r) => s + r.price_cents, 0);
  const packagesSold = pkgs ?? [];
  const packagesCents = packagesSold.reduce((s, r) => s + r.price_cents, 0);
  const total = servicesCents + packagesCents;
  const ticket = paid.length ? Math.round(servicesCents / paid.length) : 0;

  const prevDone = prevRows.filter(isDone);
  const prevPaid = prevDone.filter((r) => !prevPkgIds.has(r.id));
  const prevTotal =
    prevPaid.reduce((s, r) => s + r.price_cents, 0) + (prevPkgs ?? []).reduce((s, r) => s + r.price_cents, 0);
  const prevTicket = prevPaid.length
    ? Math.round(prevPaid.reduce((s, r) => s + r.price_cents, 0) / prevPaid.length)
    : 0;

  const upcoming = appts.filter((r) => r.status === "confirmed" && !r.done);
  const upcomingCents = upcoming.reduce((s, r) => s + r.price_cents, 0);

  // Gráfico: por dia (ou por mês, se o período for longo)
  const span = daysBetween(period.from, period.to) + 1;
  const byMonth = span > 62;
  const bucketOf = (day: string) => (byMonth ? day.slice(0, 7) : day);
  const buckets = new Map<string, { cents: number; count: number }>();
  if (byMonth) {
    for (let m = period.from.slice(0, 7); m <= period.to.slice(0, 7); m = addDays(`${m}-28`, 4).slice(0, 7))
      buckets.set(m, { cents: 0, count: 0 });
  } else {
    for (let d = period.from; d <= period.to; d = addDays(d, 1)) buckets.set(d, { cents: 0, count: 0 });
  }
  for (const r of done) {
    const b = buckets.get(bucketOf(r.day));
    if (!b) continue;
    b.count += 1;
    if (!r.byPackage) b.cents += r.price_cents;
  }
  for (const p of packagesSold) {
    const b = buckets.get(bucketOf(dayKey(p.purchased_at, tz)));
    if (b) b.cents += p.price_cents;
  }
  const chart = [...buckets.entries()].map(([key, v]) => ({ key, ...v }));

  // Por profissional
  const pct = new Map((commissions ?? []).map((c) => [c.professional_id, Number(c.pct)]));
  const proMap = new Map<
    string,
    { id: string; name: string; count: number; byPackage: number; cents: number; baseCents: number; noShows: number }
  >();
  for (const r of appts) {
    const p = proMap.get(r.professional_id) ?? {
      id: r.professional_id,
      name: r.professional?.name ?? "Profissional",
      count: 0,
      byPackage: 0,
      cents: 0,
      baseCents: 0,
      noShows: 0,
    };
    if (r.done) {
      p.count += 1;
      p.baseCents += r.price_cents;
      if (r.byPackage) p.byPackage += 1;
      else p.cents += r.price_cents;
    }
    if (r.status === "no_show") p.noShows += 1;
    proMap.set(r.professional_id, p);
  }
  const byPro = [...proMap.values()]
    .filter((p) => p.count || p.noShows)
    .map((p) => {
      const c = pct.get(p.id);
      return { ...p, pct: c ?? null, commissionCents: c != null ? Math.round((p.baseCents * c) / 100) : null };
    })
    .sort((a, b) => b.baseCents - a.baseCents || b.count - a.count);

  // Por serviço
  const svcMap = new Map<string, { name: string; count: number; cents: number }>();
  for (const r of done) {
    const s = svcMap.get(r.service_id) ?? { name: r.service?.name ?? "Serviço", count: 0, cents: 0 };
    s.count += 1;
    if (!r.byPackage) s.cents += r.price_cents;
    svcMap.set(r.service_id, s);
  }
  const byService = [...svcMap.values()];

  // Pacotes: vendidos no período e saldo em aberto hoje
  let openSessions = 0;
  let openCents = 0;
  if (!onlyMine) {
    const { data: open } = await supabase
      .from("client_packages")
      .select("price_cents, expires_at, items:client_package_items(quantity, used)")
      .eq("salon_id", salon.id)
      .eq("status", "active")
      .returns<{ price_cents: number; expires_at: string | null; items: { quantity: number; used: number }[] }[]>();
    for (const cp of open ?? []) {
      if (cp.expires_at && cp.expires_at < nowIso) continue;
      const qty = cp.items.reduce((s, i) => s + i.quantity, 0);
      const left = cp.items.reduce((s, i) => s + Math.max(0, i.quantity - i.used), 0);
      openSessions += left;
      if (qty) openCents += Math.round((cp.price_cents * left) / qty);
    }
  }
  const pkgByName = new Map<string, { name: string; count: number; cents: number }>();
  for (const p of packagesSold) {
    const g = pkgByName.get(p.name) ?? { name: p.name, count: 0, cents: 0 };
    g.count += 1;
    g.cents += p.price_cents;
    pkgByName.set(p.name, g);
  }
  const packages = {
    sold: packagesSold.length,
    cents: packagesCents,
    sessionsUsed: done.filter((r) => r.byPackage).length,
    openSessions,
    openCents,
    byName: [...pkgByName.values()].sort((a, b) => b.cents - a.cents),
  };

  // Clientes
  const attended = new Map<string, { id: string; name: string; visits: number; cents: number }>();
  for (const r of done) {
    const c = attended.get(r.client_id) ?? {
      id: r.client_id,
      name: r.client?.name ?? r.client?.phone ?? "Cliente",
      visits: 0,
      cents: 0,
    };
    c.visits += 1;
    if (!r.byPackage) c.cents += r.price_cents;
    attended.set(r.client_id, c);
  }
  for (const p of packagesSold) {
    const c = attended.get(p.client_id) ?? {
      id: p.client_id,
      name: p.client?.name ?? p.client?.phone ?? "Cliente",
      visits: 0,
      cents: 0,
    };
    c.cents += p.price_cents;
    attended.set(p.client_id, c);
  }
  const fromIso = iso(period.from);
  const firstVisit = new Map((stats ?? []).map((s) => [s.client_id, s.first_visit_at]));
  let newClients = 0;
  let returning = 0;
  for (const r of done) firstVisit.set(r.client_id, firstVisit.get(r.client_id) ?? r.starts_at);
  for (const id of new Set(done.map((r) => r.client_id))) {
    const fv = firstVisit.get(id);
    if (fv && fv < fromIso) returning += 1;
    else newClients += 1;
  }
  const gone = (stats ?? []).filter((s) => leadStatus(s, salon.inactive_after_days) === "sumido").length;
  const topClients = [...attended.values()].sort((a, b) => b.cents - a.cents || b.visits - a.visits).slice(0, 10);

  // Faltas e cancelamentos
  const noShows = appts.filter((r) => r.status === "no_show");
  const cancelled = appts.filter((r) => r.status === "cancelled");
  const losses = {
    noShows: noShows.length,
    noShowCents: noShows.reduce((s, r) => s + r.price_cents, 0),
    cancelled: cancelled.length,
    cancelledCents: cancelled.reduce((s, r) => s + r.price_cents, 0),
    rate: appts.length ? Math.round(((noShows.length + cancelled.length) / appts.length) * 100) : 0,
  };

  return {
    salon,
    tz,
    period,
    onlyMine,
    showMoney,
    owner,
    appts,
    packagesSold,
    summary: {
      total,
      servicesCents,
      packagesCents,
      ticket,
      attended: done.length,
      paidCount: paid.length,
      prevTotal,
      prevTicket,
      prevAttended: prevDone.length,
      upcoming: upcoming.length,
      upcomingCents,
    },
    chart,
    byMonth,
    byPro,
    byService,
    packages,
    clients: { attended: new Set(done.map((r) => r.client_id)).size, newClients, returning, gone, topClients },
    losses,
  };
}

export type Report = Awaited<ReturnType<typeof loadReport>>;

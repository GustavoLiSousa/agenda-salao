import Link from "next/link";
import { headers } from "next/headers";
import { BrandMark } from "@/components/brand-mark";
import { DayStrip } from "@/components/day-strip";
import { ShareLink } from "@/components/share-link";
import { SalonCover, SalonLogo } from "@/components/salon-brand";
import { Avatar, Card } from "@/components/ui";
import { birthdayMessage, comeBackMessage, daysSince, leadStatus, type ClientStats } from "@/lib/clients";
import { formatPrice, whatsappLink } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireSalon } from "@/lib/session";
import { addDays, dayKey, formatTime, isValidDay, todayIn, zonedToDate } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";

export const metadata = { title: "Início | Agenda Salão" };

type Appt = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  professional_id: string;
  client: { name: string | null; phone: string } | null;
  service: { name: string } | null;
  professional: { name: string } | null;
};

type MonthRow = {
  status: AppointmentStatus;
  price_cents: number;
  ends_at: string;
  professional_id: string;
  service: { name: string } | null;
  professional: { name: string } | null;
};

const STATUS: Record<AppointmentStatus, { label: string; dot: string }> = {
  confirmed: { label: "Confirmado", dot: "bg-brand-400" },
  completed: { label: "Atendido", dot: "bg-emerald-500" },
  no_show: { label: "Faltou", dot: "bg-amber-500" },
  cancelled: { label: "Desmarcado", dot: "bg-stone-300 dark:bg-stone-600" },
};

const longDay = (d: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`),
  );

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams;
  const { supabase, user, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;
  const owner = membership.role === "owner";
  // Funcionário sem permissão vê só a própria agenda e não vê valores.
  const onlyMine = !can(membership, "agenda_equipe");
  const myPro = membership.professional_id;
  const showMoney = can(membership, "faturamento");
  const today = todayIn(tz);
  const day = isValidDay(dia) && dia >= today ? dia : today;
  const monthStart = `${today.slice(0, 7)}-01`;
  const iso = (d: string) => zonedToDate(d, "00:00", tz).toISOString();
  const nowIso = new Date().toISOString();
  const mine: Record<string, string> = onlyMine
    ? { professional_id: myPro ?? "00000000-0000-0000-0000-000000000000" }
    : {};

  const [{ data: dayRows }, { data: nextDays }, { data: monthRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, price_cents, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)",
      )
      .eq("salon_id", salon.id)
      .gte("starts_at", iso(day))
      .lt("starts_at", iso(addDays(day, 1)))
      .match(mine)
      .order("starts_at")
      .returns<Appt[]>(),
    supabase
      .from("appointments")
      .select("starts_at, professional_id")
      .eq("salon_id", salon.id)
      .neq("status", "cancelled")
      .gte("starts_at", iso(today))
      .lt("starts_at", iso(addDays(today, 14)))
      .match(mine)
      .returns<{ starts_at: string }[]>(),
    supabase
      .from("appointments")
      .select("status, price_cents, ends_at, professional_id, service:services(name), professional:professionals(name)")
      .eq("salon_id", salon.id)
      .gte("starts_at", iso(monthStart))
      .lt("starts_at", iso(addDays(today, 1)))
      .match(mine)
      .returns<MonthRow[]>(),
  ]);

  const [{ data: stats }, { count: packageRequests }, { count: joinRequests }, { count: freedCount }, setupCounts] =
    await Promise.all([
      supabase.from("client_stats").select("*").eq("salon_id", salon.id).returns<ClientStats[]>(),
      can(membership, "pacotes")
        ? supabase
            .from("package_requests")
            .select("id", { count: "exact", head: true })
            .eq("salon_id", salon.id)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
      owner
        ? supabase
            .from("salon_join_requests")
            .select("id", { count: "exact", head: true })
            .eq("salon_id", salon.id)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id)
        .eq("status", "cancelled")
        .gt("starts_at", nowIso)
        .gt("cancelled_at", new Date(Date.now() - 72 * 3_600_000).toISOString())
        .match(mine),
      owner
        ? Promise.all([
            supabase
              .from("services")
              .select("id", { count: "exact", head: true })
              .eq("salon_id", salon.id)
              .is("archived_at", null),
            supabase
              .from("professionals")
              .select("id", { count: "exact", head: true })
              .eq("salon_id", salon.id)
              .is("archived_at", null),
          ])
        : null,
    ]);

  // Dia escolhido
  const list = dayRows ?? [];
  const active = list.filter((r) => r.status !== "cancelled");
  const expected = active.filter((r) => r.status !== "no_show").reduce((s, r) => s + r.price_cents, 0);
  const next = day === today ? list.find((r) => r.status === "confirmed" && r.starts_at > nowIso) : undefined;
  const counts: Record<string, number> = {};
  for (const r of nextDays ?? []) {
    const k = dayKey(r.starts_at, tz);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const byPro = new Map<string, { name: string; items: Appt[] }>();
  for (const r of list) {
    const g = byPro.get(r.professional_id) ?? { name: r.professional?.name ?? "", items: [] };
    g.items.push(r);
    byPro.set(r.professional_id, g);
  }

  // Produção do mês: o que foi feito e por quem
  const done = (monthRows ?? []).filter(
    (r) => r.status === "completed" || (r.status === "confirmed" && r.ends_at < nowIso),
  );
  const monthRevenue = done.reduce((s, r) => s + r.price_cents, 0);
  const byService = new Map<string, number>();
  for (const r of done)
    byService.set(r.service?.name ?? "Serviço", (byService.get(r.service?.name ?? "Serviço") ?? 0) + 1);
  const team = new Map<string, { name: string; count: number; cents: number }>();
  for (const r of done) {
    const t = team.get(r.professional_id) ?? { name: r.professional?.name ?? "", count: 0, cents: 0 };
    t.count += 1;
    t.cents += r.price_cents;
    team.set(r.professional_id, t);
  }
  const teamList = [...team.values()].sort((a, b) => b.count - a.count);
  const topServices = [...byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const todayDone = done.filter((r) => dayKey(r.ends_at, tz) === today).length;

  // Clientes
  const clients = stats ?? [];
  const comeBack = clients
    .filter((c) => {
      const st = leadStatus(c, salon.inactive_after_days);
      return st === "sumido" || st === "vencendo";
    })
    .sort((a, b) => (daysSince(b.last_visit_at) ?? 0) - (daysSince(a.last_visit_at) ?? 0));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i).slice(5));
  const birthdays = clients.filter((c) => c.birthday && week.includes(c.birthday.slice(5)));

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const bookingLink = `${proto}://${host}/${salon.slug}`;

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];
  const setup = setupCounts
    ? [
        { done: (setupCounts[0].count ?? 0) > 0, label: "Cadastrar os serviços", href: "/painel/servicos" },
        {
          done: (setupCounts[1].count ?? 0) > 0,
          label: "Cadastrar a equipe e os horários",
          href: "/painel/profissionais",
        },
        { done: !!salon.whatsapp, label: "Colocar WhatsApp, endereço e fotos", href: "/painel/configuracoes" },
      ]
    : [];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dayLabel = day === today ? "Hoje" : day === addDays(today, 1) ? "Amanhã" : longDay(day);

  return (
    <main className="flex flex-col gap-5">
      {/* Abertura com a capa e o logo do salão */}
      <section className="relative isolate overflow-hidden rounded-3xl px-5 pb-5 pt-6 text-white sm:px-7">
        <SalonCover salon={salon} />
        <div className="flex items-center gap-3">
          <SalonLogo salon={salon} className="h-14 w-14 ring-2 ring-white/50 shadow-lg" />
          <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.24em] text-white/85">
            {salon.name}
          </p>
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold drop-shadow">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-white/75 first-letter:uppercase">
          {longDay(today)} ·{" "}
          {counts[today] ? `${counts[today]} horário${counts[today] === 1 ? "" : "s"} hoje` : "nenhum horário hoje"}
          {onlyMine ? " na sua agenda" : ""}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/painel/agenda/novo?data=${day}${onlyMine && myPro ? `&prof=${myPro}` : ""}`}
            className="rounded-xl bg-[linear-gradient(110deg,#c026d3,#f43f5e_60%,#fb923c)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/40"
          >
            + Agendar
          </Link>
          <Link
            href={`/painel/agenda?data=${day}`}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
          >
            Abrir agenda
          </Link>
          <Link
            href={`/painel/agenda/livres?data=${day}`}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
          >
            Divulgar horários livres
          </Link>
        </div>
      </section>

      <ShareLink slug={salon.slug} salonName={salon.name} />

      {/* Avisos que pedem ação */}
      {isAdmin && (
        <Notify href="/painel/convites">🎟️ Convites: gere códigos para novos salões entrarem na plataforma</Notify>
      )}
      {(joinRequests ?? 0) > 0 && (
        <Notify href="/painel/profissionais#pedidos">
          👋 {joinRequests} {joinRequests === 1 ? "pessoa pediu" : "pessoas pediram"} para entrar na equipe
        </Notify>
      )}
      {(packageRequests ?? 0) > 0 && (
        <Notify href="/painel/pacotes#pedidos">
          📦 {packageRequests} {packageRequests === 1 ? "pedido de pacote" : "pedidos de pacote"} pelo app esperando
          você
        </Notify>
      )}
      {setup.some((s) => !s.done) && (
        <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/40">
          <h2 className="font-display text-lg font-semibold">Deixe o salão pronto</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {setup.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-emerald-600 text-white" : "border border-stone-400"}`}
                  >
                    {s.done ? "✓" : ""}
                  </span>
                  <span className={s.done ? "text-stone-400 line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Escolha do dia */}
          <DayStrip
            start={today}
            selected={day}
            today={today}
            counts={counts}
            href={(d) => (d === today ? "/painel" : `/painel?dia=${d}`)}
          />

          {next && (
            <Card className="flex items-center gap-4 border-brand-300 dark:border-brand-800">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-stone-950 text-brand-200">
                <span className="text-[10px] uppercase tracking-wider opacity-70">próximo</span>
                <span className="font-semibold">{formatTime(next.starts_at, tz)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{next.client?.name ?? "Cliente"}</p>
                <p className="truncate text-sm text-stone-500">
                  {next.service?.name}
                  {onlyMine ? "" : ` com ${next.professional?.name}`}
                </p>
              </div>
              {next.client?.phone && (
                <a
                  href={whatsappLink(
                    next.client.phone,
                    `Olá ${next.client.name ?? ""}! Passando para lembrar do seu horário hoje às ${formatTime(next.starts_at, tz)} no ${salon.name}. Te esperamos!`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#1f9d55] px-3 py-2 text-xs font-semibold text-white"
                >
                  Lembrar
                </a>
              )}
            </Card>
          )}

          {/* Agenda do dia */}
          <Card className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5 dark:border-stone-800">
              <div>
                <h2 className="font-display text-lg font-semibold first-letter:uppercase">
                  {onlyMine ? "Minha agenda" : "Agenda"} · {dayLabel}
                </h2>
                <p className="text-xs text-stone-500">
                  {active.length} horário{active.length === 1 ? "" : "s"}
                  {showMoney && active.length > 0 ? ` · ${formatPrice(expected)} previsto` : ""}
                </p>
              </div>
              <Link href={`/painel/agenda?data=${day}`} className="text-sm text-brand-700 dark:text-brand-300">
                Ver dia ›
              </Link>
            </div>
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BrandMark className="h-10 w-10 opacity-40" />
                <p className="text-sm text-stone-500">
                  Nenhum horário marcado {day === today ? "para hoje" : "neste dia"}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {[...byPro.entries()].map(([id, g]) => (
                  <div key={id} className="px-4 py-3 sm:px-5">
                    {!onlyMine && (
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">{g.name}</p>
                    )}
                    <ul className="flex flex-col">
                      {g.items.map((r) => (
                        <li
                          key={r.id}
                          className={`flex items-center gap-3 py-1.5 ${r.status === "cancelled" ? "opacity-45" : ""}`}
                        >
                          <span className="w-12 font-mono text-sm tabular-nums">{formatTime(r.starts_at, tz)}</span>
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${STATUS[r.status].dot}`}
                            title={STATUS[r.status].label}
                          />
                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${r.status === "cancelled" ? "line-through" : ""}`}
                          >
                            <span className="font-medium">{r.client?.name ?? "Cliente"}</span>
                            <span className="text-stone-500"> · {r.service?.name}</span>
                          </span>
                          {r.status !== "confirmed" && (
                            <span className="text-xs text-stone-500">{STATUS[r.status].label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(freedCount ?? 0) > 0 && (
            <Link
              href="/painel/agenda"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              <b>{freedCount} vaga(s) liberada(s)</b> por clientes que desmarcaram. Toque para divulgar ›
            </Link>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="flex flex-col gap-4">
          {/* Atendimentos concluídos no mês */}
          <Card className="p-0">
            <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
              <h2 className="font-display text-lg font-semibold">
                {onlyMine ? "Meus atendimentos no mês" : "Atendimentos no mês"}
              </h2>
              <p className="text-xs text-stone-500">Concluídos do dia 1º até agora</p>
              <div className={`mt-3 grid gap-2 ${showMoney ? "grid-cols-3" : "grid-cols-2"}`}>
                <Stat label="No mês" value={String(done.length)} />
                <Stat label="Hoje" value={String(todayDone)} />
                {showMoney && <Stat label="Faturado" value={formatPrice(monthRevenue)} />}
              </div>
            </div>
            {!onlyMine && teamList.length > 0 && (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                <li className="flex items-center gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  <span className="flex-1">Por profissional</span>
                  <span>Atend.</span>
                  {showMoney && <span className="w-24 text-right">Faturado</span>}
                </li>
                {teamList.map((t) => (
                  <li key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={t.name} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                    <span className="text-sm tabular-nums text-stone-600 dark:text-stone-300">{t.count}</span>
                    {showMoney && (
                      <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatPrice(t.cents)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {topServices.length > 0 ? (
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
                  Serviços mais realizados
                </p>
                <ul className="flex flex-col gap-1.5">
                  {topServices.map(([name, n]) => (
                    <li key={name} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span
                        className="h-1.5 rounded-full bg-brand-300"
                        style={{ width: `${Math.max(8, (n / topServices[0][1]) * 80)}px` }}
                      />
                      <span className="w-6 text-right tabular-nums text-stone-500">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-stone-500">Nenhum atendimento ainda este mês.</p>
            )}
          </Card>

          {owner && (
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
                <div>
                  <h2 className="font-display text-lg font-semibold">Clientes para trazer de volta</h2>
                  <p className="text-xs text-stone-500">
                    Sem horário marcado e já no tempo de voltar (ou passaram dele)
                  </p>
                </div>
                <Link href="/painel/clientes" className="shrink-0 text-sm text-brand-700 dark:text-brand-300">
                  Ver {comeBack.length} ›
                </Link>
              </div>
              {comeBack.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-stone-500">Todos os clientes estão em dia. Ótimo!</p>
              ) : (
                <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                  {comeBack.slice(0, 5).map((c) => (
                    <li key={c.client_id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar name={c.name} src={c.avatar_url} size={34} />
                      <Link href={`/painel/clientes/${c.client_id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name ?? c.phone}</p>
                        <p className="text-xs text-stone-500">última visita há {daysSince(c.last_visit_at)} dias</p>
                      </Link>
                      <a
                        href={whatsappLink(c.phone, comeBackMessage(c, salon.name, bookingLink))}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-emerald-600/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        Chamar
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {birthdays.length > 0 && (
            <Card className="p-0">
              <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
                <h2 className="font-display text-lg font-semibold">Aniversários da semana</h2>
              </div>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {birthdays.map((c) => (
                  <li key={c.client_id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={c.name} src={c.avatar_url} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name ?? c.phone}</p>
                      <p className="text-xs text-stone-500">
                        {c.birthday!.slice(8, 10)}/{c.birthday!.slice(5, 7)}
                      </p>
                    </div>
                    <a
                      href={whatsappLink(c.phone, birthdayMessage(c, salon.name, bookingLink))}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-emerald-600/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                    >
                      Parabéns
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function Notify({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100"
    >
      <span>{children}</span>
      <span aria-hidden>›</span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2.5 py-2 dark:bg-stone-800/60">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="truncate font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

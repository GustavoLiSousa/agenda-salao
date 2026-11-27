import Link from "next/link";
import { headers } from "next/headers";
import { ShareLink } from "@/components/share-link";
import { Avatar, Badge, Card, LinkButton, PageHeader, Stat } from "@/components/ui";
import { birthdayMessage, comeBackMessage, daysSince, leadStatus, type ClientStats } from "@/lib/clients";
import { formatPrice, whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";
import { addDays, dayKey, formatLongDate, formatTime, todayIn, zonedToDate } from "@/lib/time";
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

const STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmado", cls: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  completed: { label: "Atendido", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  no_show: { label: "Faltou", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  cancelled: { label: "Desmarcado", cls: "bg-stone-100 text-stone-400 line-through dark:bg-stone-800" },
};

export default async function PainelPage() {
  const { supabase, user, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;
  const today = todayIn(tz);
  const monthStart = `${today.slice(0, 7)}-01`;
  const iso = (d: string) => zonedToDate(d, "00:00", tz).toISOString();
  const nowIso = new Date().toISOString();

  const [{ data: todayRows }, { data: monthRows }, { data: stats }, { count: servicesCount }, { count: prosCount }, { count: freedCount }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, price_cents, professional_id, client:clients(name, phone), service:services(name), professional:professionals(name)")
        .eq("salon_id", salon.id)
        .gte("starts_at", iso(today))
        .lt("starts_at", iso(addDays(today, 1)))
        .order("starts_at")
        .returns<Appt[]>(),
      supabase
        .from("appointments")
        .select("status, price_cents, ends_at")
        .eq("salon_id", salon.id)
        .gte("starts_at", iso(monthStart))
        .lt("starts_at", iso(addDays(today, 1)))
        .returns<{ status: AppointmentStatus; price_cents: number; ends_at: string }[]>(),
      supabase.from("client_stats").select("*").eq("salon_id", salon.id).returns<ClientStats[]>(),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).is("archived_at", null),
      supabase.from("professionals").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).is("archived_at", null),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id)
        .eq("status", "cancelled")
        .gt("starts_at", nowIso)
        .gt("cancelled_at", new Date(Date.now() - 72 * 3_600_000).toISOString()),
    ]);

  const todayList = todayRows ?? [];
  const todayActive = todayList.filter((r) => r.status !== "cancelled");
  const expected = todayActive.filter((r) => r.status !== "no_show").reduce((s, r) => s + r.price_cents, 0);
  const done = todayList.filter((r) => r.status === "completed" || (r.status === "confirmed" && r.ends_at < nowIso)).length;
  const noShows = todayList.filter((r) => r.status === "no_show").length;
  const next = todayList.find((r) => r.status === "confirmed" && r.starts_at > nowIso);

  const month = monthRows ?? [];
  const monthDone = month.filter((r) => r.status === "completed" || (r.status === "confirmed" && r.ends_at < nowIso));
  const monthRevenue = monthDone.reduce((s, r) => s + r.price_cents, 0);

  const clients = stats ?? [];
  const newThisMonth = clients.filter((c) => c.first_visit_at && dayKey(c.first_visit_at, tz) >= monthStart).length;
  const comeBack = clients
    .filter((c) => {
      const st = leadStatus(c, salon.inactive_after_days);
      return st === "sumido" || st === "vencendo";
    })
    .sort((a, b) => (daysSince(b.last_visit_at) ?? 0) - (daysSince(a.last_visit_at) ?? 0));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i).slice(5));
  const birthdays = clients.filter((c) => c.birthday && week.includes(c.birthday.slice(5)));

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const bookingLink = `${proto}://${host}/${salon.slug}`;

  // agrupa a agenda de hoje por profissional
  const byPro = new Map<string, { name: string; items: Appt[] }>();
  for (const r of todayList) {
    const g = byPro.get(r.professional_id) ?? { name: r.professional?.name ?? "", items: [] };
    g.items.push(r);
    byPro.set(r.professional_id, g);
  }

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];
  const setup = [
    { done: (servicesCount ?? 0) > 0, label: "Cadastrar os serviços", href: "/painel/servicos" },
    { done: (prosCount ?? 0) > 0, label: "Cadastrar a equipe e os horários", href: "/painel/profissionais" },
    { done: !!salon.whatsapp, label: "Colocar WhatsApp, endereço e fotos", href: "/painel/configuracoes" },
  ];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={`Olá${firstName ? `, ${firstName}` : ""}`}
        subtitle={<span className="first-letter:uppercase">{formatLongDate(new Date(), tz)} · {salon.name}</span>}
        actions={
          <>
            <LinkButton href="/painel/agenda/novo" variant="primary">+ Agendar</LinkButton>
            <LinkButton href="/painel/agenda" variant="secondary">Agenda completa</LinkButton>
            <LinkButton href="/painel/pacotes" variant="secondary">Pacotes</LinkButton>
            <LinkButton href="/painel/avaliacoes" variant="secondary">Avaliações</LinkButton>
          </>
        }
      />

      {membership.role === "owner" && setup.some((s) => !s.done) && (
        <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/40">
          <h2 className="font-display text-lg font-semibold">Deixe o salão pronto</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {setup.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-emerald-600 text-white" : "border border-stone-400"}`}>
                    {s.done ? "✓" : ""}
                  </span>
                  <span className={s.done ? "text-stone-400 line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hoje" value={`${todayActive.length} horário${todayActive.length === 1 ? "" : "s"}`} hint={`${done} atendido(s) · ${noShows} falta(s)`} />
        <Stat label="Previsto hoje" value={formatPrice(expected)} />
        <Stat label="Faturado no mês" value={formatPrice(monthRevenue)} hint={`${monthDone.length} atendimento(s)`} />
        <Stat label="Clientes" value={clients.length} hint={`${newThisMonth} novo(s) este mês`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Agenda de hoje */}
        <div className="flex flex-col gap-4">
          {next && (
            <Card className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                <span className="text-[10px] uppercase tracking-wider opacity-70">próx.</span>
                <span className="font-semibold">{formatTime(next.starts_at, tz)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{next.client?.name ?? "Cliente"}</p>
                <p className="truncate text-sm text-stone-500">
                  {next.service?.name} com {next.professional?.name}
                </p>
              </div>
              {next.client?.phone && (
                <a
                  href={whatsappLink(next.client.phone, `Olá ${next.client.name ?? ""}! Passando para lembrar do seu horário hoje às ${formatTime(next.starts_at, tz)} no ${salon.name}. Te esperamos!`)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#1f9d55] px-3 py-2 text-xs font-semibold text-white"
                >
                  Lembrar
                </a>
              )}
            </Card>
          )}

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5 dark:border-stone-800">
              <h2 className="font-display text-lg font-semibold">Agenda de hoje</h2>
              <Link href="/painel/agenda" className="text-sm text-brand-700 dark:text-brand-300">Ver tudo ›</Link>
            </div>
            {todayList.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-500 sm:px-5">Nenhum horário marcado para hoje.</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {[...byPro.values()].map((g) => (
                  <div key={g.name} className="px-4 py-3 sm:px-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">{g.name}</p>
                    <ul className="flex flex-col gap-2">
                      {g.items.map((r) => (
                        <li key={r.id} className={`flex items-center gap-3 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                          <span className="w-12 font-mono text-sm tabular-nums">{formatTime(r.starts_at, tz)}</span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className="font-medium">{r.client?.name ?? "Cliente"}</span>
                            <span className="text-stone-500"> · {r.service?.name}</span>
                          </span>
                          <Badge className={STATUS[r.status].cls}>{STATUS[r.status].label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(freedCount ?? 0) > 0 && (
            <Link href="/painel/agenda" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <b>{freedCount} vaga(s) liberada(s)</b> por clientes que desmarcaram. Toque para divulgar ›
            </Link>
          )}

          <ShareLink slug={salon.slug} salonName={salon.name} />
        </div>

        {/* Coluna lateral */}
        <div className="flex flex-col gap-4">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
              <h2 className="font-display text-lg font-semibold">Chamar de volta</h2>
              <Link href="/painel/clientes" className="text-sm text-brand-700 dark:text-brand-300">{comeBack.length} ›</Link>
            </div>
            {comeBack.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-500">Ninguém atrasado. Ótimo!</p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {comeBack.slice(0, 5).map((c) => (
                  <li key={c.client_id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={c.name} size={34} />
                    <Link href={`/painel/clientes/${c.client_id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name ?? c.phone}</p>
                      <p className="text-xs text-stone-500">há {daysSince(c.last_visit_at)} dias</p>
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

          {birthdays.length > 0 && (
            <Card className="p-0">
              <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
                <h2 className="font-display text-lg font-semibold">Aniversários da semana</h2>
              </div>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {birthdays.map((c) => (
                  <li key={c.client_id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={c.name} size={34} />
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

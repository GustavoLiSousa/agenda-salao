import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Button, Card, Field, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { daysSince, LEAD_LABEL, leadStatus, RETURN_SOURCE_LABEL, type ClientStats } from "@/lib/clients";
import { formatPhone, formatPrice, whatsappLink } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireSalon } from "@/lib/session";
import { addDays, dayKey, formatTime, shortDay, todayIn } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import type { ClientPackage, SalonPackage } from "@/lib/packages";
import { saveClient, setReturnDays } from "../actions";
import { PackagesCard } from "./packages-card";

export const metadata = { title: "Cliente | Agenda Salão" };

const STATUS: Record<AppointmentStatus, { label: string; cls: string }> = {
  confirmed: { label: "Marcado", cls: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  completed: { label: "Atendido", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  cancelled: { label: "Desmarcado", cls: "bg-stone-100 text-stone-400 dark:bg-stone-800" },
  no_show: { label: "Faltou", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
};

const OK: Record<string, string> = {
  "1": "Dados salvos.",
  novo: "Cliente cadastrado.",
  retorno: "Retorno atualizado.",
  pacote: "Pacote vendido. O saldo já está abaixo.",
  uso: "Sessão descontada do pacote.",
  desfeito: "Uso desfeito. A sessão voltou para o saldo.",
  cancelado: "Pacote cancelado.",
};

const RETURN_CHOICES = [7, 15, 21, 30, 45, 60];

type Hist = {
  id: string;
  starts_at: string;
  status: AppointmentStatus;
  price_cents: number;
  service: { name: string } | null;
  professional: { name: string } | null;
};

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-sm transition ${
    on
      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
      : "border-stone-300 hover:border-stone-500 dark:border-stone-700"
  }`;

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string; aba?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;

  const [{ data: c }, { data: hist }, { data: owned }, { data: offers }] = await Promise.all([
    supabase.from("client_stats").select("*").eq("client_id", id).eq("salon_id", salon.id).maybeSingle<ClientStats>(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, price_cents, service:services(name), professional:professionals(name)")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<Hist[]>(),
    supabase
      .from("client_packages")
      .select(
        "id, name, price_cents, purchased_at, expires_at, status, notes, items:client_package_items(service_id, quantity, used, service:services(name)), uses:package_uses(id, service_id, used_at, undone_at)",
      )
      .eq("client_id", id)
      .order("purchased_at", { ascending: false })
      .order("used_at", { referencedTable: "package_uses", ascending: false })
      .returns<ClientPackage[]>(),
    supabase
      .from("packages")
      .select("*, items:package_items(service_id, quantity, service:services(name, price_cents, active))")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .returns<SalonPackage[]>(),
  ]);
  if (!c) notFound();

  const st = leadStatus(c, salon.inactive_after_days);
  const since = daysSince(c.last_visit_at);
  const loyalty = salon.loyalty_visits;
  const stamps = loyalty ? c.visits % loyalty : 0;
  const rewardsEarned = loyalty ? Math.floor(c.visits / loyalty) : 0;
  const fixed = c.return_source === "cliente" ? c.return_every_days : null;
  // Fidelidade só vale para quem não tem pacote ativo
  const nowIso = new Date().toISOString();
  const activePackage = (owned ?? []).find(
    (p) =>
      p.status === "active" && (!p.expires_at || p.expires_at > nowIso) && p.items.some((i) => i.used < i.quantity),
  );
  const TABS = [
    { key: "retorno", label: "Retorno" },
    { key: "pacotes", label: "Pacotes" },
    ...(loyalty ? [{ key: "fidelidade", label: "Fidelidade" }] : []),
    { key: "historico", label: "Histórico" },
    { key: "dados", label: "Dados" },
  ];
  const okTab: Record<string, string> = {
    "1": "dados",
    retorno: "retorno",
    pacote: "pacotes",
    uso: "pacotes",
    desfeito: "pacotes",
    cancelado: "pacotes",
  };
  const tab = TABS.some((t) => t.key === q.aba) ? q.aba! : (q.ok && okTab[q.ok]) || "retorno";
  const tabHref = (k: string) => `/painel/clientes/${c.client_id}?aba=${k}`;
  const nextReturn =
    c.last_visit_at && c.return_every_days ? addDays(dayKey(c.last_visit_at, tz), c.return_every_days) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader back={{ href: "/painel/clientes", label: "Clientes" }} title="" />
      <div className="-mt-4 flex items-center gap-4">
        <Avatar name={c.name} src={c.avatar_url} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold">{c.name ?? "Sem nome"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            {formatPhone(c.phone)}
            <Badge className={LEAD_LABEL[st].cls}>{LEAD_LABEL[st].label}</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappLink(c.phone, `Olá ${c.name ?? ""}! Aqui é do ${salon.name}.`)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-xl bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white"
        >
          WhatsApp
        </a>
        <LinkButton
          variant="secondary"
          href={`/painel/agenda/novo?nome=${encodeURIComponent(c.name ?? "")}&tel=${c.phone}`}
        >
          Agendar horário
        </LinkButton>
      </div>

      {q.ok && OK[q.ok] && <Notice kind="success">{OK[q.ok]}</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Visitas" value={c.visits} hint={c.no_shows ? `${c.no_shows} falta(s)` : undefined} />
        <Stat label="Última visita" value={since === null ? "–" : `há ${since}d`} />
        <Stat label="Gasto total" value={can(membership, "faturamento") ? formatPrice(c.total_spent_cents) : "–"} />
        <Stat
          label="Próximo"
          value={c.next_appointment_at ? shortDay(dayKey(c.next_appointment_at, tz)) : "–"}
          hint={c.next_appointment_at ? formatTime(c.next_appointment_at, tz) : undefined}
        />
      </div>

      <nav className="sticky top-[57px] z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-stone-200 bg-[var(--background)]/95 px-4 backdrop-blur dark:border-stone-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            replace
            scroll={false}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-fuchsia-600 text-stone-900 dark:border-fuchsia-400 dark:text-white"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "retorno" && (
        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">De quanto em quanto tempo volta</h2>
            <p className="text-sm text-stone-500">
              {c.return_every_days
                ? `A cada ${c.return_every_days} dias (${RETURN_SOURCE_LABEL[c.return_source ?? "media"]}).`
                : `Ainda sem regra: usa ${salon.inactive_after_days} dias do salão.`}
              {nextReturn
                ? nextReturn < todayIn(tz)
                  ? ` Era para ter voltado em ${shortDay(nextReturn)}.`
                  : ` Deve voltar por volta de ${shortDay(nextReturn)}.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RETURN_CHOICES.map((d) => (
              <form key={d} action={setReturnDays}>
                <input type="hidden" name="id" value={c.client_id} />
                <input type="hidden" name="days" value={d} />
                <button className={chip(fixed === d)}>{d} dias</button>
              </form>
            ))}
            <form action={setReturnDays}>
              <input type="hidden" name="id" value={c.client_id} />
              <input type="hidden" name="days" value="" />
              <button className={chip(fixed === null)}>Automático</button>
            </form>
          </div>
          <form action={setReturnDays} className="flex items-end gap-2">
            <input type="hidden" name="id" value={c.client_id} />
            <div className="w-32">
              <Field
                label="Outro (dias)"
                name="days"
                type="number"
                min={1}
                max={365}
                defaultValue={fixed && !RETURN_CHOICES.includes(fixed) ? fixed : ""}
              />
            </div>
            <Button className="py-2 text-sm">Usar</Button>
          </form>
          <p className="text-xs text-stone-400">Automático = usa o retorno do último serviço ou a média das visitas.</p>
        </Card>
      )}

      {tab === "pacotes" && (
        <PackagesCard
          clientId={c.client_id}
          owned={owned ?? []}
          offers={(offers ?? []).filter((p) => p.items.length > 0)}
          tz={tz}
          isOwner={membership.role === "owner"}
        />
      )}

      {tab === "fidelidade" && loyalty && (
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Cartão fidelidade</h2>
            <span className="text-sm text-stone-500">
              {stamps}/{loyalty}
            </span>
          </div>
          {activePackage && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Este cliente tem o pacote <b>{activePackage.name}</b> ativo. A fidelidade só vale para quem não tem
              pacote, então o benefício fica pausado enquanto o pacote durar.
            </p>
          )}
          <div className={`mt-3 flex flex-wrap gap-2 ${activePackage ? "opacity-40 grayscale" : ""}`}>
            {Array.from({ length: loyalty }, (_, i) => (
              <span
                key={i}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs ${
                  i < stamps
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-dashed border-stone-300 text-stone-400 dark:border-stone-700"
                }`}
              >
                {i < stamps ? "✓" : i + 1}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-500">
            {salon.loyalty_reward ? `Ao completar ganha: ${salon.loyalty_reward}.` : ""}
            {rewardsEarned > 0 ? ` Já completou ${rewardsEarned} cartão(ões).` : ""}
          </p>
        </Card>
      )}

      {tab === "dados" && (
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold">Dados</h2>
          <form action={saveClient} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={c.client_id} />
            <input type="hidden" name="return_every_days" value={fixed ?? ""} />
            <Field label="Nome" name="name" defaultValue={c.name ?? ""} />
            <Field label="Aniversário" name="birthday" type="date" defaultValue={c.birthday ?? ""} />
            <div className="sm:col-span-2">
              <Field
                label="Observações"
                name="notes"
                defaultValue={c.notes ?? ""}
                placeholder="Prefere máquina 2, alergia..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="accepts_marketing"
                defaultChecked={c.accepts_marketing}
                className="h-4 w-4 accent-stone-900"
              />
              Aceita receber mensagens e promoções
            </label>
            <Button className="sm:col-span-2 sm:justify-self-start">Salvar dados</Button>
          </form>
        </Card>
      )}

      {tab === "historico" && (
        <Card className="p-0">
          <h2 className="border-b border-stone-100 px-4 py-3 font-display text-lg font-semibold sm:px-5 dark:border-stone-800">
            Histórico
          </h2>
          {hist?.length ? (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {hist.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
                  <div className="w-20 shrink-0">
                    <p className="font-medium first-letter:uppercase">{shortDay(dayKey(h.starts_at, tz))}</p>
                    <p className="text-xs text-stone-500">{formatTime(h.starts_at, tz)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{h.service?.name}</p>
                    <p className="truncate text-xs text-stone-500">com {h.professional?.name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={STATUS[h.status].cls}>{STATUS[h.status].label}</Badge>
                    {can(membership, "faturamento") && (
                      <span className="text-xs text-stone-500">{formatPrice(h.price_cents)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-stone-500 sm:px-5">Sem agendamentos.</p>
          )}
        </Card>
      )}
    </main>
  );
}

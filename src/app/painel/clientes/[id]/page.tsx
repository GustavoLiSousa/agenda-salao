import { notFound } from "next/navigation";
import { Avatar, Badge, Button, Card, Field, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { daysSince, LEAD_LABEL, leadStatus, RETURN_SOURCE_LABEL, type ClientStats } from "@/lib/clients";
import { formatPhone, formatPrice, whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";
import { addDays, dayKey, formatTime, shortDay, todayIn } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import { saveClient, setReturnDays } from "../actions";

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
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;

  const [{ data: c }, { data: hist }] = await Promise.all([
    supabase.from("client_stats").select("*").eq("client_id", id).eq("salon_id", salon.id).maybeSingle<ClientStats>(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, price_cents, service:services(name), professional:professionals(name)")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<Hist[]>(),
  ]);
  if (!c) notFound();

  const st = leadStatus(c, salon.inactive_after_days);
  const since = daysSince(c.last_visit_at);
  const loyalty = salon.loyalty_visits;
  const stamps = loyalty ? c.visits % loyalty : 0;
  const rewardsEarned = loyalty ? Math.floor(c.visits / loyalty) : 0;
  const fixed = c.return_source === "cliente" ? c.return_every_days : null;
  const nextReturn =
    c.last_visit_at && c.return_every_days ? addDays(dayKey(c.last_visit_at, tz), c.return_every_days) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader back={{ href: "/painel/clientes", label: "Clientes" }} title="" />
      <div className="-mt-4 flex items-center gap-4">
        <Avatar name={c.name} size={64} />
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
        <LinkButton variant="secondary" href={`/painel/agenda/novo?nome=${encodeURIComponent(c.name ?? "")}&tel=${c.phone}`}>
          Agendar horário
        </LinkButton>
      </div>

      {q.ok && OK[q.ok] && <Notice kind="success">{OK[q.ok]}</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Visitas" value={c.visits} hint={c.no_shows ? `${c.no_shows} falta(s)` : undefined} />
        <Stat label="Última visita" value={since === null ? "–" : `há ${since}d`} />
        <Stat label="Gasto total" value={formatPrice(c.total_spent_cents)} />
        <Stat
          label="Próximo"
          value={c.next_appointment_at ? shortDay(dayKey(c.next_appointment_at, tz)) : "–"}
          hint={c.next_appointment_at ? formatTime(c.next_appointment_at, tz) : undefined}
        />
      </div>

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
            <Field label="Outro (dias)" name="days" type="number" min={1} max={365} defaultValue={fixed && !RETURN_CHOICES.includes(fixed) ? fixed : ""} />
          </div>
          <Button className="py-2 text-sm">Usar</Button>
        </form>
        <p className="text-xs text-stone-400">Automático = usa o retorno do último serviço ou a média das visitas.</p>
      </Card>

      {loyalty && (
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Cartão fidelidade</h2>
            <span className="text-sm text-stone-500">
              {stamps}/{loyalty}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: loyalty }, (_, i) => (
              <span
                key={i}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs ${
                  i < stamps ? "border-brand-500 bg-brand-500 text-white" : "border-dashed border-stone-300 text-stone-400 dark:border-stone-700"
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

      <Card>
        <h2 className="mb-3 font-display text-lg font-semibold">Dados</h2>
        <form action={saveClient} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={c.client_id} />
          <input type="hidden" name="return_every_days" value={fixed ?? ""} />
          <Field label="Nome" name="name" defaultValue={c.name ?? ""} />
          <Field label="Aniversário" name="birthday" type="date" defaultValue={c.birthday ?? ""} />
          <div className="sm:col-span-2">
            <Field label="Observações" name="notes" defaultValue={c.notes ?? ""} placeholder="Prefere máquina 2, alergia..." />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="accepts_marketing" defaultChecked={c.accepts_marketing} className="h-4 w-4 accent-stone-900" />
            Aceita receber mensagens e promoções
          </label>
          <Button className="sm:col-span-2 sm:justify-self-start">Salvar dados</Button>
        </form>
      </Card>

      <Card className="p-0">
        <h2 className="border-b border-stone-100 px-4 py-3 font-display text-lg font-semibold sm:px-5 dark:border-stone-800">Histórico</h2>
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
                  <span className="text-xs text-stone-500">{formatPrice(h.price_cents)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-stone-500 sm:px-5">Sem agendamentos.</p>
        )}
      </Card>
    </main>
  );
}

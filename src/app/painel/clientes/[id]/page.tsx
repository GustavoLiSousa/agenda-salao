import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Field, Notice } from "@/components/ui";
import { daysSince, LEAD_LABEL, leadStatus, type ClientStats } from "@/lib/clients";
import { formatPrice, whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";
import { dayKey, formatTime, shortDay } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import { saveClient } from "../actions";

export const metadata = { title: "Cliente | Agenda Salão" };

const STATUS: Record<AppointmentStatus, string> = {
  confirmed: "Marcado",
  completed: "Atendido",
  cancelled: "Desmarcado",
  no_show: "Faltou",
};

type Hist = {
  id: string;
  starts_at: string;
  status: AppointmentStatus;
  price_cents: number;
  service: { name: string } | null;
  professional: { name: string } | null;
};

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

  const [{ data: c }, { data: raw }, { data: hist }] = await Promise.all([
    supabase.from("client_stats").select("*").eq("client_id", id).eq("salon_id", salon.id).maybeSingle<ClientStats>(),
    supabase.from("clients").select("return_every_days").eq("id", id).maybeSingle<{ return_every_days: number | null }>(),
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

  return (
    <main className="flex flex-col gap-4">
      <Link href="/painel/clientes" className="text-sm text-violet-600">‹ Clientes</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{c.name ?? "Sem nome"}</h1>
          <p className="text-sm text-neutral-500">+{c.phone}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${LEAD_LABEL[st].cls}`}>{LEAD_LABEL[st].label}</span>
      </div>
      {q.ok && <Notice>Dados salvos.</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: String(c.visits), l: "visitas" },
          { n: since === null ? "–" : `${since}d`, l: "desde a última" },
          { n: formatPrice(c.total_spent_cents), l: "gasto total" },
        ].map((s) => (
          <Card key={s.l} className="p-2">
            <p className="text-lg font-bold">{s.n}</p>
            <p className="text-xs text-neutral-500">{s.l}</p>
          </Card>
        ))}
      </div>

      {loyalty && (
        <Card>
          <p className="mb-2 text-sm font-semibold">Cartão fidelidade</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: loyalty }, (_, i) => (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                  i < stamps ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {i < stamps ? "✓" : i + 1}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {stamps} de {loyalty} visitas{salon.loyalty_reward ? ` para ganhar: ${salon.loyalty_reward}` : ""}.
            {rewardsEarned > 0 ? ` Já completou ${rewardsEarned} cartão(ões).` : ""}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={whatsappLink(c.phone, `Oi ${c.name ?? ""}! Aqui é do ${salon.name}.`)} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white">
          WhatsApp
        </a>
        <Link href={`/painel/agenda/novo`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
          Agendar
        </Link>
      </div>

      <Card>
        <form action={saveClient} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={c.client_id} />
          <Field label="Nome" name="name" defaultValue={c.name ?? ""} />
          <Field label="Aniversário" name="birthday" type="date" defaultValue={c.birthday ?? ""} />
          <Field
            label="Volta a cada (dias)"
            name="return_every_days"
            type="number"
            min={1}
            max={365}
            defaultValue={raw?.return_every_days ?? ""}
            placeholder={c.return_every_days ? String(c.return_every_days) : "7, 15, 30..."}
            hint="Vazio = usa o retorno do serviço ou a média das visitas."
          />
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="accepts_marketing" defaultChecked={c.accepts_marketing} /> Aceita receber mensagens
          </label>
          <div className="sm:col-span-2">
            <Field label="Observações" name="notes" defaultValue={c.notes ?? ""} placeholder="Prefere máquina 2, alergia..." />
          </div>
          <Button className="sm:col-span-2 sm:justify-self-start">Salvar</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Histórico</h2>
        {hist?.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {hist.map((h) => (
              <li key={h.id} className="flex justify-between gap-2">
                <span>
                  {shortDay(dayKey(h.starts_at, tz))} {formatTime(h.starts_at, tz)} · {h.service?.name} · {h.professional?.name}
                </span>
                <span className="shrink-0 text-neutral-500">
                  {STATUS[h.status]} · {formatPrice(h.price_cents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Sem agendamentos.</p>
        )}
      </Card>
    </main>
  );
}

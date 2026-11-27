import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Field, GhostButton, Notice, Select } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { WEEKDAYS } from "@/lib/parse";
import { requireSalon } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import type { Professional, Service } from "@/lib/types";
import { addTimeBlock, removeTimeBlock, saveProfessional, saveWorkingHours } from "../actions";

export const metadata = { title: "Profissional | Agenda Salão" };

type Hour = { weekday: number; start_time: string; end_time: string };
type Block = { id: string; starts_at: string; ends_at: string; reason: string | null };

const OK: Record<string, string> = {
  dados: "Dados salvos.",
  horarios: "Horários salvos.",
  bloqueio: "Bloqueios atualizados.",
};

const hhmm = (t: string) => t.slice(0, 5);
const timeInput = "rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export default async function ProfissionalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string }>;
}) {
  const { id } = await params;
  const { erro, ok, novo } = await searchParams;
  const { supabase, membership } = await requireSalon();
  const tz = membership.salon.timezone;

  const { data: pro } = await supabase
    .from("professionals")
    .select("*")
    .eq("id", id)
    .eq("salon_id", membership.salon.id)
    .maybeSingle<Professional & { phone: string | null }>();
  if (!pro) notFound();

  const [{ data: services }, { data: links }, { data: hours }, { data: blocks }] = await Promise.all([
    supabase.from("services").select("*").eq("salon_id", membership.salon.id).eq("active", true).order("name").returns<Service[]>(),
    supabase.from("professional_services").select("service_id").eq("professional_id", id),
    supabase.from("working_hours").select("weekday, start_time, end_time").eq("professional_id", id).order("start_time").returns<Hour[]>(),
    supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, reason")
      .eq("professional_id", id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .returns<Block[]>(),
  ]);
  const doing = new Set((links ?? []).map((l) => l.service_id as string));

  return (
    <main className="flex flex-col gap-4">
      <Link href="/painel/profissionais" className="text-sm text-violet-600">
        ‹ Profissionais
      </Link>
      <h1 className="text-2xl font-bold">{pro.name}</h1>
      {novo && <Notice>Profissional criado! Confira os serviços e horários abaixo.</Notice>}
      {erro && <Notice kind="error">{erro}</Notice>}
      {ok && OK[ok] && <Notice>{OK[ok]}</Notice>}

      {/* Dados, serviços e abertura da agenda */}
      <Card>
        <form action={saveProfessional} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={pro.id} />
          <h2 className="font-semibold">Dados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" name="name" defaultValue={pro.name} required />
            <Field label="Telefone" name="phone" type="tel" defaultValue={pro.phone ?? ""} />
            <div className="sm:col-span-2">
              <Field label="Apresentação (aparece para o cliente)" name="bio" defaultValue={pro.bio ?? ""} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={pro.active} /> Ativo (aparece no link do salão)
          </label>

          <h2 className="font-semibold">Serviços que faz</h2>
          {services?.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="services" value={s.id} defaultChecked={doing.has(s.id)} />
                  {s.name} <span className="text-neutral-500">({formatPrice(s.price_cents)})</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Cadastre serviços primeiro em <Link className="text-violet-600" href="/painel/servicos">Serviços</Link>.
            </p>
          )}

          <h2 className="font-semibold">Abertura da agenda</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Como a agenda abre" name="release_mode" defaultValue={pro.release_mode}>
              <option value="rolling">Sempre aberta (próximos dias)</option>
              <option value="weekly">Abre uma vez por semana</option>
            </Select>
            <Field
              label="Sempre aberta: quantos dias à frente"
              name="release_days_ahead"
              type="number"
              min={1}
              max={365}
              defaultValue={pro.release_days_ahead}
            />
            <Select
              label="Semanal: dia que abre"
              name="release_weekday"
              defaultValue={pro.release_weekday ?? 1}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
            <Field
              label="Semanal: hora que abre"
              name="release_time"
              type="time"
              defaultValue={pro.release_time ? hhmm(pro.release_time) : "00:00"}
            />
            <Field
              label="Semanal: quantas semanas libera"
              name="release_weeks_ahead"
              type="number"
              min={1}
              max={8}
              defaultValue={pro.release_weeks_ahead}
              hint="1 = libera só a semana seguinte."
            />
            <Select label="Horários oferecidos a cada" name="slot_step_min" defaultValue={pro.slot_step_min}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </Select>
          </div>
          <Button className="self-start">Salvar dados</Button>
        </form>
      </Card>

      {/* Horário semanal */}
      <Card>
        <form action={saveWorkingHours} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={pro.id} />
          <div>
            <h2 className="font-semibold">Horário de trabalho</h2>
            <p className="text-xs text-neutral-500">
              Use o segundo período para o intervalo de almoço. Dia desmarcado = folga fixa.
            </p>
          </div>
          {WEEKDAYS.map((label, d) => {
            const day = (hours ?? []).filter((h) => h.weekday === d);
            return (
              <div key={label} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-28 items-center gap-2 font-medium">
                  <input type="checkbox" name={`on_${d}`} defaultChecked={day.length > 0} />
                  {label}
                </label>
                <input className={timeInput} type="time" name={`start1_${d}`} defaultValue={day[0] ? hhmm(day[0].start_time) : "09:00"} />
                <span>às</span>
                <input className={timeInput} type="time" name={`end1_${d}`} defaultValue={day[0] ? hhmm(day[0].end_time) : "12:00"} />
                <span className="text-neutral-400">e</span>
                <input className={timeInput} type="time" name={`start2_${d}`} defaultValue={day[1] ? hhmm(day[1].start_time) : day.length ? "" : "13:00"} />
                <span>às</span>
                <input className={timeInput} type="time" name={`end2_${d}`} defaultValue={day[1] ? hhmm(day[1].end_time) : day.length ? "" : "19:00"} />
              </div>
            );
          })}
          <Button className="self-start">Salvar horários</Button>
        </form>
      </Card>

      {/* Folgas e bloqueios */}
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Folgas e bloqueios</h2>
          <p className="text-xs text-neutral-500">Férias, médico, feriado... Nesse período ninguém consegue agendar.</p>
        </div>
        {blocks?.length ? (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {formatDateTime(b.starts_at, tz)} até {formatDateTime(b.ends_at, tz)}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
                <form action={removeTimeBlock}>
                  <input type="hidden" name="id" value={pro.id} />
                  <input type="hidden" name="block_id" value={b.id} />
                  <GhostButton>Remover</GhostButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Nenhum bloqueio programado.</p>
        )}
        <form action={addTimeBlock} className="grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2 dark:border-neutral-800">
          <input type="hidden" name="id" value={pro.id} />
          <Field label="De (data)" name="start_day" type="date" required />
          <Field label="Até (data)" name="end_day" type="date" hint="Deixe vazio se for só um dia." />
          <Field label="Hora início" name="start_time" type="time" defaultValue="09:00" />
          <Field label="Hora fim" name="end_time" type="time" defaultValue="19:00" />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="all_day" /> Dia inteiro (ignora as horas)
          </label>
          <div className="sm:col-span-2">
            <Field label="Motivo (opcional)" name="reason" placeholder="Férias" />
          </div>
          <Button className="self-start">Adicionar bloqueio</Button>
        </form>
      </Card>
    </main>
  );
}

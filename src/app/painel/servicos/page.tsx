import { ImageInput } from "@/components/image-input";
import { Button, Card, Field, GhostButton, Notice, PageHeader } from "@/components/ui";
import { formatDuration, formatPrice } from "@/lib/format";
import { centsToInput } from "@/lib/parse";
import { requireSalon } from "@/lib/session";
import type { Service } from "@/lib/types";
import { deleteService, saveService, toggleService } from "./actions";

export const metadata = { title: "Serviços | Agenda Salão" };

function ServiceForm({ service }: { service?: Service }) {
  return (
    <form action={saveService} className="grid gap-4 sm:grid-cols-[220px_1fr]">
      {service && <input type="hidden" name="id" value={service.id} />}
      <ImageInput name="image" label="Foto" current={service?.image_url} removeName={service ? "remove_image" : undefined} />
      <div className="grid content-start gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome" name="name" defaultValue={service?.name} placeholder="Corte + barba" required />
        </div>
        <Field
          label="Preço (R$)"
          name="price"
          inputMode="decimal"
          defaultValue={service ? centsToInput(service.price_cents) : ""}
          placeholder="45,00"
          required
        />
        <Field label="Duração (min)" name="duration" type="number" min={5} max={600} step={5} defaultValue={service?.duration_min ?? 30} required />
        <Field label="Categoria" name="category" defaultValue={service?.category ?? ""} placeholder="Cabelo, Barba, Unhas..." />
        <Field
          label="Cliente volta a cada (dias)"
          name="return_every_days"
          type="number"
          min={1}
          defaultValue={service?.return_every_days ?? ""}
          placeholder="Ex.: 15"
        />
        <div className="sm:col-span-2">
          <Field label="Descrição (aparece para o cliente)" name="description" defaultValue={service?.description ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Button className="w-full sm:w-auto">{service ? "Salvar alterações" : "Adicionar serviço"}</Button>
        </div>
      </div>
    </form>
  );
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const { supabase, membership } = await requireSalon();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", membership.salon.id)
    .is("archived_at", null)
    .order("active", { ascending: false })
    .order("sort_order")
    .order("name")
    .returns<Service[]>();
  const list = services ?? [];

  return (
    <main className="flex flex-col gap-5">
      <PageHeader title="Serviços" subtitle="O que aparece para o cliente escolher no link do salão." />
      {erro && <Notice kind="error">{erro}</Notice>}
      {ok && <Notice kind="success">{ok === "excluido" ? "Serviço excluído." : "Serviço salvo."}</Notice>}

      <details open={list.length === 0} className="group rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium sm:px-5">
          + Novo serviço
          <span className="text-stone-400 transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-stone-100 p-4 sm:p-5 dark:border-stone-800">
          <ServiceForm />
        </div>
      </details>

      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <li key={s.id}>
            <Card className={`overflow-hidden p-0 ${s.active ? "" : "opacity-60"}`}>
              <details className="group">
                <summary className="flex cursor-pointer list-none gap-3 p-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-2xl text-stone-300">
                        {s.name[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p className="truncate font-semibold">
                      {s.name} {!s.active && <span className="text-xs font-normal text-stone-500">(pausado)</span>}
                    </p>
                    <p className="text-sm text-stone-500">
                      {formatDuration(s.duration_min)}
                      {s.category ? ` · ${s.category}` : ""}
                    </p>
                    {s.return_every_days && <p className="text-xs text-stone-400">volta a cada {s.return_every_days} dias</p>}
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <span className="font-display text-lg font-semibold">{formatPrice(s.price_cents)}</span>
                    <span className="text-xs text-brand-700 group-open:hidden dark:text-brand-300">Editar</span>
                  </div>
                </summary>
                <div className="flex flex-col gap-4 border-t border-stone-100 p-4 dark:border-stone-800">
                  <ServiceForm service={s} />
                  <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
                    <form action={toggleService}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(s.active)} />
                      <GhostButton>{s.active ? "Pausar (some do link)" : "Reativar"}</GhostButton>
                    </form>
                    <form action={deleteService}>
                      <input type="hidden" name="id" value={s.id} />
                      <GhostButton className="border-red-200 text-red-600 dark:border-red-900">Excluir</GhostButton>
                    </form>
                  </div>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}

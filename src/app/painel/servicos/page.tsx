import { Button, Card, Field, GhostButton, Notice } from "@/components/ui";
import { formatDuration, formatPrice } from "@/lib/format";
import { centsToInput } from "@/lib/parse";
import { requireSalon } from "@/lib/session";
import type { Service } from "@/lib/types";
import { deleteService, saveService, toggleService } from "./actions";

export const metadata = { title: "Serviços | Agenda Salão" };

function ServiceForm({ service }: { service?: Service }) {
  return (
    <form action={saveService} className="grid gap-3 sm:grid-cols-2">
      {service && <input type="hidden" name="id" value={service.id} />}
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
      <Field
        label="Duração (minutos)"
        name="duration"
        type="number"
        min={5}
        max={600}
        step={5}
        defaultValue={service?.duration_min ?? 30}
        required
      />
      <Field
        label="Categoria"
        name="category"
        defaultValue={service?.category ?? ""}
        placeholder="Cabelo, Barba, Unhas..."
      />
      <Field
        label="Cliente volta a cada (dias)"
        name="return_every_days"
        type="number"
        min={1}
        defaultValue={service?.return_every_days ?? ""}
        placeholder="Ex.: 15"
        hint="Usado para lembrar o cliente de voltar."
      />
      <div className="sm:col-span-2">
        <Field
          label="Descrição (opcional)"
          name="description"
          defaultValue={service?.description ?? ""}
        />
      </div>
      <div className="sm:col-span-2">
        <Button className="w-full sm:w-auto">{service ? "Salvar" : "Adicionar serviço"}</Button>
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

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Serviços</h1>
      {erro && <Notice kind="error">{erro}</Notice>}
      {ok && <Notice kind="success">{ok === "excluido" ? "Serviço excluído." : "Serviço salvo."}</Notice>}

      <Card>
        <h2 className="mb-3 font-semibold">Novo serviço</h2>
        <ServiceForm />
      </Card>

      <ul className="flex flex-col gap-2">
        {(services ?? []).map((s) => (
          <li key={s.id}>
            <Card className={s.active ? "" : "opacity-60"}>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {s.name} {!s.active && <span className="text-xs">(pausado)</span>}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDuration(s.duration_min)}
                      {s.category ? ` · ${s.category}` : ""}
                      {s.return_every_days ? ` · volta a cada ${s.return_every_days} dias` : ""}
                    </p>
                  </div>
                  <span className="font-semibold">{formatPrice(s.price_cents)}</span>
                </summary>
                <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <ServiceForm service={s} />
                  <form action={toggleService}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={String(s.active)} />
                    <GhostButton>{s.active ? "Pausar (some do link do cliente)" : "Reativar"}</GhostButton>
                  </form>
                  <form action={deleteService}>
                    <input type="hidden" name="id" value={s.id} />
                    <GhostButton className="border-red-300 text-red-600 dark:border-red-900">Excluir serviço</GhostButton>
                  </form>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
      {services?.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum serviço ainda. Adicione o primeiro acima.</p>
      )}
    </main>
  );
}

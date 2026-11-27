import { Button, Card, Field, GhostButton, Notice, PageHeader } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { fullPrice, itemsLabel, validityLabel, type SalonPackage } from "@/lib/packages";
import { centsToInput } from "@/lib/parse";
import { requireSalon } from "@/lib/session";
import { handleRequest, savePackage, togglePackage } from "./actions";
import { formatPhone, whatsappLink } from "@/lib/format";
import { formatLongDate } from "@/lib/time";

export const metadata = { title: "Pacotes | Agenda Salão" };

type Svc = { id: string; name: string; price_cents: number };

function PackageForm({ pkg, services }: { pkg?: SalonPackage; services: Svc[] }) {
  const qty = new Map(pkg?.items.map((i) => [i.service_id, i.quantity]));
  return (
    <form action={savePackage} className="flex flex-col gap-4">
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome do pacote" name="name" defaultValue={pkg?.name} placeholder="Ex.: 4 cortes do mês" required />
        </div>
        <Field
          label="Preço do pacote (R$)"
          name="price"
          inputMode="decimal"
          defaultValue={pkg ? centsToInput(pkg.price_cents) : ""}
          placeholder="150,00"
          required
        />
        <Field
          label="Validade (dias para usar)"
          name="validity_days"
          type="number"
          min={1}
          max={730}
          defaultValue={pkg?.validity_days ?? ""}
          placeholder="Ex.: 60 (vazio = sem prazo)"
        />
        <div className="sm:col-span-2">
          <Field label="Descrição (aparece para o cliente)" name="description" defaultValue={pkg?.description ?? ""} placeholder="Ideal para quem corta toda semana." />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Serviços e quantidade de sessões</p>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
          {services.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                {s.name} <span className="text-stone-400">· {formatPrice(s.price_cents)}</span>
              </span>
              <input
                type="number"
                name={`qty_${s.id}`}
                min={0}
                max={100}
                defaultValue={qty.get(s.id) ?? ""}
                placeholder="0"
                aria-label={`Quantidade de ${s.name}`}
                className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-center text-base dark:border-stone-700 dark:bg-stone-900"
              />
            </li>
          ))}
        </ul>
        {services.length === 0 && <p className="text-sm text-stone-500">Cadastre serviços primeiro.</p>}
      </div>
      <Button className="sm:self-start">{pkg ? "Salvar alterações" : "Criar pacote"}</Button>
    </form>
  );
}

export default async function PacotesPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salonId = membership.salon.id;
  const isOwner = membership.role === "owner";

  type Req = {
    id: string;
    created_at: string;
    package: { name: string; price_cents: number } | null;
    client: { id: string; name: string | null; phone: string } | null;
  };
  const { data: reqs } = await supabase
    .from("package_requests")
    .select("id, created_at, package:packages(name, price_cents), client:clients(id, name, phone)")
    .eq("salon_id", salonId)
    .eq("status", "pending")
    .order("created_at")
    .returns<Req[]>();
  const requests = reqs ?? [];

  const [{ data: pkgs }, { data: svcs }, { data: sold }] = await Promise.all([
    supabase
      .from("packages")
      .select("*, items:package_items(service_id, quantity, service:services(name, price_cents, active, archived_at))")
      .eq("salon_id", salonId)
      .order("active", { ascending: false })
      .order("sort_order")
      .order("created_at")
      .returns<SalonPackage[]>(),
    supabase
      .from("services")
      .select("id, name, price_cents")
      .eq("salon_id", salonId)
      .eq("active", true)
      .is("archived_at", null)
      .order("sort_order")
      .order("name")
      .returns<Svc[]>(),
    supabase.from("client_packages").select("package_id").eq("salon_id", salonId).eq("status", "active").returns<{ package_id: string | null }[]>(),
  ]);
  const list = pkgs ?? [];
  const services = svcs ?? [];
  const soldCount = new Map<string, number>();
  for (const s of sold ?? []) if (s.package_id) soldCount.set(s.package_id, (soldCount.get(s.package_id) ?? 0) + 1);

  return (
    <main className="flex flex-col gap-5">
      <PageHeader
        title="Pacotes"
        subtitle="Combos com desconto que aparecem na página do salão. A venda é registrada na ficha do cliente."
      />
      {erro && <Notice kind="error">{erro}</Notice>}
      {ok && (
        <Notice kind="success">
          {ok === "venda" ? "Venda registrada. O pacote já aparece para o cliente." : ok === "recusado" ? "Pedido recusado." : "Pacote salvo."}
        </Notice>
      )}

      {requests.length > 0 && (
        <section id="pedidos" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Pedidos pelo app ({requests.length})
          </h2>
          {requests.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 border-brand-200 dark:border-brand-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{r.client?.name ?? "Cliente"} quer o pacote “{r.package?.name}”</p>
                  <p className="text-xs text-stone-500">
                    {r.client ? formatPhone(r.client.phone) : ""} · pedido em {formatLongDate(r.created_at, membership.salon.timezone)}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold">{formatPrice(r.package?.price_cents ?? 0)}</span>
              </div>
              <p className="text-xs text-stone-500">
                Combine o pagamento com o cliente. Ao confirmar, o pacote entra na ficha dele e o saldo aparece no app.
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={handleRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="accept" value="1" />
                  <Button>Confirmar venda</Button>
                </form>
                {r.client && (
                  <a
                    href={whatsappLink(r.client.phone, `Olá, ${r.client.name ?? ""}! Recebemos seu pedido do pacote "${r.package?.name}".`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl border border-stone-300 px-3.5 py-2 text-sm font-medium dark:border-stone-700"
                  >
                    WhatsApp
                  </a>
                )}
                <form action={handleRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="accept" value="0" />
                  <GhostButton>Recusar</GhostButton>
                </form>
              </div>
            </Card>
          ))}
        </section>
      )}

      {isOwner && (
        <details open={list.length === 0} className="group rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium sm:px-5">
            + Novo pacote
            <span className="text-stone-400 transition group-open:rotate-45">+</span>
          </summary>
          <div className="border-t border-stone-100 p-4 sm:p-5 dark:border-stone-800">
            <PackageForm services={services} />
          </div>
        </details>
      )}

      {list.length === 0 && !isOwner && <p className="text-sm text-stone-500">O salão ainda não tem pacotes.</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => {
          const full = fullPrice(p.items);
          const save = full - p.price_cents;
          return (
            <li key={p.id}>
              <Card className={`p-0 ${p.active ? "" : "opacity-60"}`}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-col gap-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">
                        {p.name} {!p.active && <span className="text-xs font-normal text-stone-500">(pausado)</span>}
                      </p>
                      <span className="font-display text-lg font-semibold">{formatPrice(p.price_cents)}</span>
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400">{itemsLabel(p.items)}</p>
                    <p className="text-xs text-stone-500">
                      {validityLabel(p.validity_days)}
                      {save > 0 ? ` · economia de ${formatPrice(save)}` : ""}
                      {soldCount.get(p.id) ? ` · ${soldCount.get(p.id)} vendido(s) ativo(s)` : ""}
                    </p>
                    {isOwner && <span className="mt-1 text-xs text-brand-700 group-open:hidden dark:text-brand-300">Editar</span>}
                  </summary>
                  {isOwner && (
                    <div className="flex flex-col gap-4 border-t border-stone-100 p-4 dark:border-stone-800">
                      <PackageForm pkg={p} services={services} />
                      <form action={togglePackage} className="border-t border-stone-100 pt-4 dark:border-stone-800">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={String(p.active)} />
                        <GhostButton>{p.active ? "Pausar (some da página do salão)" : "Reativar"}</GhostButton>
                      </form>
                      <p className="text-xs text-stone-400">Mudanças valem para as próximas vendas. Quem já comprou mantém o que comprou.</p>
                    </div>
                  )}
                </details>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

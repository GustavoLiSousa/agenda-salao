import { Badge, Button, Card, Field } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { isExpired, itemsLabel, remaining, type ClientPackage, type SalonPackage } from "@/lib/packages";
import { dayKey, shortDay } from "@/lib/time";
import { cancelClientPackage, registerPackageUse, sellPackage, undoPackageUse } from "../actions";

export function PackagesCard({
  clientId,
  owned,
  offers,
  tz,
  isOwner,
}: {
  clientId: string;
  owned: ClientPackage[];
  offers: SalonPackage[];
  tz: string;
  isOwner: boolean;
}) {
  const names = new Map(owned.flatMap((cp) => cp.items.map((i) => [i.service_id, i.service?.name ?? "serviço"])));
  return (
    <Card id="pacotes" className="flex scroll-mt-20 flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Pacotes</h2>

      {owned.length === 0 && <p className="text-sm text-stone-500">Nenhum pacote comprado.</p>}

      {owned.map((cp) => {
        const expired = isExpired(cp);
        const left = remaining(cp);
        const usable = cp.status === "active" && !expired;
        const uses = cp.uses.filter((u) => !u.undone_at).slice(0, 5);
        return (
          <div key={cp.id} className={`rounded-xl border border-stone-200 p-3 dark:border-stone-800 ${usable && left > 0 ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{cp.name}</p>
                <p className="text-xs text-stone-500">
                  Comprado em {shortDay(dayKey(cp.purchased_at, tz))} por {formatPrice(cp.price_cents)}
                  {cp.expires_at ? ` · vence ${shortDay(dayKey(cp.expires_at, tz))}` : ""}
                </p>
              </div>
              {cp.status === "cancelled" ? (
                <Badge className="bg-stone-100 text-stone-500 dark:bg-stone-800">Cancelado</Badge>
              ) : expired ? (
                <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Vencido</Badge>
              ) : left === 0 ? (
                <Badge className="bg-stone-100 text-stone-500 dark:bg-stone-800">Usado</Badge>
              ) : (
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{left} sessão(ões)</Badge>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {cp.items.map((i) => (
                <li key={i.service_id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.service?.name}</span>
                  <span className="flex gap-1" aria-label={`${i.used} de ${i.quantity} usadas`}>
                    {Array.from({ length: Math.min(i.quantity, 12) }, (_, k) => (
                      <span key={k} className={`h-2.5 w-2.5 rounded-full ${k < i.used ? "bg-stone-300 dark:bg-stone-700" : "bg-brand-500"}`} />
                    ))}
                  </span>
                  <span className="w-12 text-right text-xs text-stone-500">
                    {i.quantity - i.used}/{i.quantity}
                  </span>
                  {usable && i.used < i.quantity && (
                    <form action={registerPackageUse}>
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="client_package_id" value={cp.id} />
                      <input type="hidden" name="service_id" value={i.service_id} />
                      <button className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium hover:border-stone-500 dark:border-stone-700">
                        Usar 1
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {uses.length > 0 && (
              <details className="mt-3 text-xs text-stone-500">
                <summary className="cursor-pointer">Últimos usos</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {uses.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2">
                      <span>
                        {shortDay(dayKey(u.used_at, tz))} · {names.get(u.service_id)}
                      </span>
                      <form action={undoPackageUse}>
                        <input type="hidden" name="client_id" value={clientId} />
                        <input type="hidden" name="use_id" value={u.id} />
                        <button className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-stone-100">Desfazer</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {isOwner && cp.status === "active" && (
              <form action={cancelClientPackage} className="mt-2 text-right">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="client_package_id" value={cp.id} />
                <button className="text-xs text-stone-400 underline underline-offset-2 hover:text-red-600">Cancelar pacote</button>
              </form>
            )}
          </div>
        );
      })}

      {offers.length > 0 ? (
        <details className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium">+ Vender pacote</summary>
          <form action={sellPackage} className="flex flex-col gap-3 border-t border-stone-100 p-3 dark:border-stone-800">
            <input type="hidden" name="client_id" value={clientId} />
            <fieldset className="flex flex-col gap-2">
              {offers.map((p, idx) => (
                <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-2.5 text-sm has-[:checked]:border-stone-900 dark:border-stone-800 dark:has-[:checked]:border-stone-100">
                  <input type="radio" name="package_id" value={p.id} defaultChecked={idx === 0} className="mt-1 accent-stone-900" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-stone-500">{itemsLabel(p.items)}</span>
                  </span>
                  <span className="font-semibold">{formatPrice(p.price_cents)}</span>
                </label>
              ))}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor cobrado (se diferente)" name="price" inputMode="decimal" placeholder="Vazio = preço do pacote" />
              <Field label="Observação" name="notes" placeholder="Pago no Pix, dinheiro..." />
            </div>
            <Button className="sm:self-start">Registrar venda</Button>
          </form>
        </details>
      ) : (
        <p className="text-xs text-stone-400">Crie pacotes em Painel › Pacotes para vender aqui.</p>
      )}
    </Card>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui";
import type { MyPackage, MyPackageRequest } from "@/lib/client-area";
import { formatPrice } from "@/lib/format";
import { isExpired } from "@/lib/packages";
import { formatLongDate } from "@/lib/time";
import { cancelPackageRequest } from "./actions";

/** Pacotes do cliente: saldo por serviço, validade e pedidos esperando o salão. */
export function MyPackages({
  packages,
  requests,
  showSalon,
  back,
}: {
  packages: MyPackage[];
  requests: MyPackageRequest[];
  showSalon: boolean;
  back: string;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const declined = requests.filter((r) => r.status === "declined");
  return (
    <>
      {pending.map((r) => (
        <Card key={r.id} className="flex flex-col gap-2 border-dashed">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.package_name}</p>
              <p className="text-xs text-stone-500">
                {showSalon ? `${r.salon_name} · ` : ""}
                {formatPrice(r.price_cents)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Aguardando o salão
            </span>
          </div>
          <p className="text-xs text-stone-500">
            O salão vai combinar o pagamento com você e confirmar. Aí o saldo aparece aqui.
          </p>
          <form action={cancelPackageRequest}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="back" value={back} />
            <button className="text-xs text-stone-500 underline-offset-4 hover:underline">Desistir do pedido</button>
          </form>
        </Card>
      ))}
      {declined.map((r) => (
        <p key={r.id} className="text-xs text-stone-500">
          O salão não confirmou o pedido do pacote “{r.package_name}”. Fale com ele pelo WhatsApp.
        </p>
      ))}
      {packages.map((p) => {
        const expired = isExpired(p);
        const left = p.items.reduce((n, i) => n + i.quantity - i.used, 0);
        const total = p.items.reduce((n, i) => n + i.quantity, 0);
        const off = p.status !== "active" || expired || left === 0;
        return (
          <Card key={p.id} className={`flex flex-col gap-3 ${off ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-stone-500">
                  {showSalon ? `${p.salon_name} · ` : ""}
                  comprado em {formatLongDate(p.purchased_at, "America/Sao_Paulo")}
                </p>
                {p.expires_at && (
                  <p className={`text-xs ${expired ? "text-red-600 dark:text-red-300" : "text-stone-500"}`}>
                    {expired ? "Venceu em" : "Use até"} {formatLongDate(p.expires_at, "America/Sao_Paulo")}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                {p.status !== "active"
                  ? "Cancelado"
                  : expired
                    ? "Vencido"
                    : left === 0
                      ? "Usado"
                      : `${left} de ${total} restantes`}
              </span>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {p.items.map((i) => (
                <li key={i.service} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">{i.service}</span>
                    <span className="text-xs text-stone-500">
                      {i.used} usada(s) · {i.quantity - i.used} restante(s)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${(i.used / i.quantity) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {!off && (
              <Link
                href={`/${p.salon_slug}/agendar`}
                className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
              >
                Agendar uma sessão ›
              </Link>
            )}
          </Card>
        );
      })}
    </>
  );
}

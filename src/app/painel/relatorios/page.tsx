import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { loadReport, PERIODS, type ReportQuery } from "@/lib/reports";
import { requireSalon } from "@/lib/session";
import { shortDay } from "@/lib/time";
import { PrintButton } from "./print-button";

export const metadata = { title: "Relatórios | Agenda Salão" };

const longDate = (d: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`),
  );
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(new Date(`${m}-15T12:00:00Z`))
    .replace(".", "");

function Delta({ now, before, money }: { now: number; before: number; money?: boolean }) {
  if (!before && !now) return <span className="text-xs text-stone-400">sem movimento antes</span>;
  if (!before) return <span className="text-xs font-semibold text-emerald-600">novo</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%{" "}
      <span className="font-normal text-stone-500">
        (antes: {money ? formatPrice(before) : before})
      </span>
    </span>
  );
}

function Big({
  label,
  value,
  children,
  tone = "from-fuchsia-500 to-rose-500",
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone}`} />
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-stone-900 dark:text-stone-50">{value}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

function Bar({ value, max, tone = "bg-fuchsia-500" }: { value: number; max: number; tone?: string }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }} />
    </span>
  );
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const r = await loadReport(supabase, membership, q);
  const { period, summary: s, showMoney, onlyMine } = r;
  const money = (c: number) => (showMoney ? formatPrice(c) : "—");
  const qs = new URLSearchParams({ p: period.key, ...(period.key === "personalizado" ? { de: period.from, ate: period.to } : {}) });
  const rangeLabel = period.from === period.to ? longDate(period.from) : `${longDate(period.from)} a ${longDate(period.to)}`;

  const chartMax = Math.max(1, ...r.chart.map((c) => (showMoney ? c.cents : c.count)));
  const topSold = [...r.byService].sort((a, b) => b.count - a.count).slice(0, 8);
  const topRevenue = [...r.byService].sort((a, b) => b.cents - a.cents).slice(0, 8);
  const commissionTotal = r.byPro.reduce((t, p) => t + (p.commissionCents ?? 0), 0);
  const anyCommission = r.byPro.some((p) => p.pct != null);

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{onlyMine ? "Meus relatórios" : "Relatórios"}</h1>
          <p className="text-sm text-stone-500">
            {rangeLabel}
            {onlyMine && " · só os seus atendimentos"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <a
            href={`/painel/relatorios/planilha?${qs}`}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            ⬇ Planilha
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Período */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PERIODS.filter((p) => p.key !== "personalizado").map((p) => (
            <Link
              key={p.key}
              href={`/painel/relatorios?p=${p.key}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                period.key === p.key
                  ? "bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white shadow"
                  : "border border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm" action="/painel/relatorios">
          <input type="hidden" name="p" value="personalizado" />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-stone-500">De</span>
            <input
              type="date"
              name="de"
              defaultValue={period.from}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 dark:border-stone-700 dark:bg-stone-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-stone-500">Até</span>
            <input
              type="date"
              name="ate"
              defaultValue={period.to}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 dark:border-stone-700 dark:bg-stone-900"
            />
          </label>
          <button
            className={`rounded-lg px-3 py-1.5 font-semibold ${
              period.key === "personalizado"
                ? "bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white"
                : "border border-stone-300 dark:border-stone-700"
            }`}
          >
            Ver período
          </button>
        </form>
      </div>

      {!showMoney && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Os valores em R$ estão escondidos. O dono do salão pode liberar em Equipe → permissões → &quot;Ver valores em R$ do salão&quot;.
        </p>
      )}

      {/* 1. Resumo */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showMoney && (
          <Big label="Faturamento" value={formatPrice(s.total)}>
            <Delta now={s.total} before={s.prevTotal} money />
          </Big>
        )}
        <Big label="Atendimentos" value={s.attended} tone="from-violet-500 to-fuchsia-500">
          <Delta now={s.attended} before={s.prevAttended} />
        </Big>
        {showMoney && (
          <Big label="Ticket médio" value={formatPrice(s.ticket)} tone="from-orange-400 to-rose-500">
            <Delta now={s.ticket} before={s.prevTicket} money />
          </Big>
        )}
        <Big
          label="Ainda agendado"
          value={showMoney ? formatPrice(s.upcomingCents) : s.upcoming}
          tone="from-sky-400 to-violet-500"
        >
          <span className="text-xs text-stone-500">
            {s.upcoming} {s.upcoming === 1 ? "horário marcado" : "horários marcados"} no período
          </span>
        </Big>
      </section>
      {showMoney && !onlyMine && (
        <p className="-mt-2 text-xs text-stone-500">
          Faturamento = serviços pagos na hora ({formatPrice(s.servicesCents)}) + pacotes vendidos (
          {formatPrice(s.packagesCents)}). Sessões usadas de pacote não entram de novo, porque já foram pagas na venda.
          Comparação com {shortDay(period.prevFrom)} a {shortDay(period.prevTo)}.
        </p>
      )}

      {/* Gráfico */}
      {r.chart.length > 1 && (
        <Card>
          <h2 className="font-display text-lg font-semibold">
            {showMoney ? "Faturamento" : "Atendimentos"} {r.byMonth ? "por mês" : "por dia"}
          </h2>
          <div className="mt-4 flex h-40 items-end gap-[3px]">
            {r.chart.map((c) => {
              const v = showMoney ? c.cents : c.count;
              return (
                <div key={c.key} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-fuchsia-600 to-rose-400 transition group-hover:from-fuchsia-500"
                    style={{ height: `${v ? Math.max(3, (v / chartMax) * 100) : 0}%` }}
                  />
                  <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-2 py-0.5 text-[11px] text-white group-hover:block">
                    {r.byMonth ? monthLabel(c.key) : shortDay(c.key)}: {showMoney ? formatPrice(c.cents) : c.count}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-stone-500">
            <span>{r.byMonth ? monthLabel(r.chart[0].key) : shortDay(r.chart[0].key)}</span>
            <span>
              {r.byMonth ? monthLabel(r.chart[r.chart.length - 1].key) : shortDay(r.chart[r.chart.length - 1].key)}
            </span>
          </div>
        </Card>
      )}

      {/* 2. Por profissional */}
      <Card className="p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
          <h2 className="font-display text-lg font-semibold">Por profissional</h2>
          {showMoney && anyCommission && (
            <span className="text-sm text-stone-500">
              Comissões a pagar: <b className="text-stone-900 dark:text-stone-100">{formatPrice(commissionTotal)}</b>
            </span>
          )}
        </div>
        {r.byPro.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-stone-500">
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  <th className="px-4 py-2 font-medium sm:px-5">Profissional</th>
                  <th className="px-2 py-2 text-right font-medium">Atend.</th>
                  <th className="px-2 py-2 text-right font-medium">De pacote</th>
                  {showMoney && <th className="px-2 py-2 text-right font-medium">Valor</th>}
                  {showMoney && <th className="px-4 py-2 text-right font-medium sm:px-5">Comissão</th>}
                </tr>
              </thead>
              <tbody>
                {r.byPro.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                    <td className="px-4 py-2.5 sm:px-5">
                      <span className="flex items-center gap-2">
                        <Avatar name={p.name} size={28} />
                        <span className="font-medium">{p.name}</span>
                        {p.noShows > 0 && <span className="text-xs text-amber-600">{p.noShows} falta(s)</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{p.count}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-stone-500">{p.byPackage}</td>
                    {showMoney && <td className="px-2 py-2.5 text-right tabular-nums">{formatPrice(p.cents)}</td>}
                    {showMoney && (
                      <td className="px-4 py-2.5 text-right tabular-nums sm:px-5">
                        {p.commissionCents != null ? (
                          <>
                            <b>{formatPrice(p.commissionCents)}</b>
                            <span className="block text-[11px] text-stone-500">{p.pct}% de {formatPrice(p.baseCents)}</span>
                          </>
                        ) : r.owner ? (
                          <Link href={`/painel/profissionais/${p.id}`} className="text-xs text-brand-700 underline dark:text-brand-300">
                            definir %
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {showMoney && anyCommission && (
              <p className="px-4 pb-4 pt-2 text-xs text-stone-500 sm:px-5">
                A comissão é calculada sobre todos os serviços feitos, inclusive as sessões de pacote (pelo preço do
                serviço).
              </p>
            )}
          </div>
        ) : (
          <p className="px-4 pb-4 pt-2 text-sm text-stone-500 sm:px-5">Nenhum atendimento no período.</p>
        )}
      </Card>

      {/* 3. Por serviço */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Serviços mais feitos</h2>
          {topSold.length ? (
            <ul className="mt-3 flex flex-col gap-2.5">
              {topSold.map((x) => (
                <li key={x.name} className="text-sm">
                  <span className="flex justify-between gap-2">
                    <span className="truncate">{x.name}</span>
                    <b className="tabular-nums">{x.count}</b>
                  </span>
                  <Bar value={x.count} max={topSold[0].count} tone="bg-violet-500" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone-500">Nada no período.</p>
          )}
        </Card>
        {showMoney && (
          <Card>
            <h2 className="font-display text-lg font-semibold">Serviços que mais faturaram</h2>
            {topRevenue.some((x) => x.cents) ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {topRevenue
                  .filter((x) => x.cents)
                  .map((x) => (
                    <li key={x.name} className="text-sm">
                      <span className="flex justify-between gap-2">
                        <span className="truncate">{x.name}</span>
                        <b className="tabular-nums">{formatPrice(x.cents)}</b>
                      </span>
                      <Bar value={x.cents} max={topRevenue[0].cents} tone="bg-rose-500" />
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">Nada no período.</p>
            )}
          </Card>
        )}
      </div>

      {/* 4. Pacotes */}
      {!onlyMine && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Pacotes</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-stone-500">Vendidos no período</p>
              <p className="font-display text-xl font-semibold">{r.packages.sold}</p>
            </div>
            {showMoney && (
              <div>
                <p className="text-xs text-stone-500">Valor vendido</p>
                <p className="font-display text-xl font-semibold">{formatPrice(r.packages.cents)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-stone-500">Sessões usadas no período</p>
              <p className="font-display text-xl font-semibold">{r.packages.sessionsUsed}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Sessões em aberto hoje</p>
              <p className="font-display text-xl font-semibold">{r.packages.openSessions}</p>
              {showMoney && r.packages.openCents > 0 && (
                <p className="text-[11px] text-stone-500">≈ {formatPrice(r.packages.openCents)} já pagos a atender</p>
              )}
            </div>
          </div>
          {r.packages.byName.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-100 text-sm dark:divide-stone-800">
              {r.packages.byName.map((p) => (
                <li key={p.name} className="flex justify-between gap-2 py-2">
                  <span>
                    {p.name} <span className="text-stone-500">× {p.count}</span>
                  </span>
                  {showMoney && <b className="tabular-nums">{formatPrice(p.cents)}</b>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* 5. Clientes e 6. Faltas */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Clientes</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-stone-500">Atendidos</p>
              <p className="font-display text-xl font-semibold">{r.clients.attended}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Novos</p>
              <p className="font-display text-xl font-semibold text-emerald-600">{r.clients.newClients}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Voltaram</p>
              <p className="font-display text-xl font-semibold">{r.clients.returning}</p>
            </div>
          </div>
          {!onlyMine && r.clients.gone > 0 && (
            <Link
              href="/painel/clientes?filtro=voltar"
              className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <span>
                <b>{r.clients.gone}</b> clientes sumidos hoje
              </span>
              <span>Ver ›</span>
            </Link>
          )}
          {r.clients.topClients.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-stone-500">
                {showMoney ? "Quem mais gastou" : "Quem mais veio"}
              </p>
              <ol className="mt-2 flex flex-col gap-1.5 text-sm">
                {r.clients.topClients.slice(0, 5).map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/painel/clientes/${c.id}`} className="truncate hover:underline">
                      <span className="mr-1 text-stone-400">{i + 1}.</span>
                      {c.name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-stone-600 dark:text-stone-300">
                      {c.visits} {c.visits === 1 ? "visita" : "visitas"}
                      {showMoney && <b className="ml-2 text-stone-900 dark:text-stone-100">{formatPrice(c.cents)}</b>}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Faltas e cancelamentos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 dark:text-amber-300">Faltaram</p>
              <p className="font-display text-xl font-semibold">{r.losses.noShows}</p>
              {showMoney && <p className="text-xs text-stone-500">{money(r.losses.noShowCents)} perdidos</p>}
            </div>
            <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800/60">
              <p className="text-xs text-stone-600 dark:text-stone-300">Desmarcaram</p>
              <p className="font-display text-xl font-semibold">{r.losses.cancelled}</p>
              {showMoney && <p className="text-xs text-stone-500">{money(r.losses.cancelledCents)} em horários</p>}
            </div>
          </div>
          <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
            {r.losses.rate}% dos horários do período tiveram falta ou foram desmarcados.
          </p>
        </Card>
      </div>
    </main>
  );
}

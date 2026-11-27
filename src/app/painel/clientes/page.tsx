import Link from "next/link";
import { headers } from "next/headers";
import { Card } from "@/components/ui";
import {
  birthdayMessage,
  comeBackMessage,
  daysSince,
  isBirthdayMonth,
  LEAD_LABEL,
  leadStatus,
  type ClientStats,
} from "@/lib/clients";
import { formatPrice, whatsappLink } from "@/lib/format";
import { requireSalon } from "@/lib/session";

export const metadata = { title: "Clientes | Agenda Salão" };

const FILTERS = [
  { key: "sumidos", label: "Chamar de volta" },
  { key: "todos", label: "Todos" },
  { key: "aniversario", label: "Aniversariantes" },
  { key: "novos", label: "Novos no mês" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; busca?: string }>;
}) {
  const q = await searchParams;
  const filter: Filter = (FILTERS.find((f) => f.key === q.filtro)?.key ?? "sumidos") as Filter;
  const search = (q.busca ?? "").trim();
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;

  const { data } = await supabase
    .from("client_stats")
    .select("*")
    .eq("salon_id", salon.id)
    .order("last_visit_at", { ascending: true, nullsFirst: false })
    .returns<ClientStats[]>();
  const all = data ?? [];

  const h = await headers();
  const link = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}/${salon.slug}/agendar`;
  const month = new Date().getMonth() + 1;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const withStatus = all.map((c) => ({ c, st: leadStatus(c, salon.inactive_after_days) }));
  const counts = {
    sumidos: withStatus.filter((x) => x.st === "sumido" || x.st === "vencendo").length,
    todos: all.length,
    aniversario: all.filter((c) => isBirthdayMonth(c, month)).length,
    novos: all.filter((c) => Date.parse(c.created_at) >= monthStart).length,
  };

  let list = withStatus;
  if (filter === "sumidos") list = list.filter((x) => x.st === "sumido" || x.st === "vencendo");
  if (filter === "aniversario") list = list.filter((x) => isBirthdayMonth(x.c, month));
  if (filter === "novos") list = list.filter((x) => Date.parse(x.c.created_at) >= monthStart);
  if (filter === "todos") list = [...list].sort((a, b) => (a.c.name ?? "").localeCompare(b.c.name ?? ""));
  if (search) {
    const s = search.toLowerCase();
    const digits = search.replace(/\D/g, "");
    list = list.filter((x) => (x.c.name ?? "").toLowerCase().includes(s) || (digits && x.c.phone.includes(digits)));
  }

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <p className="text-sm text-neutral-500">
        Todo telefone que agenda vira cliente. &quot;Chamar de volta&quot; mostra quem passou do tempo de voltar
        (a frequência do cliente ou {salon.inactive_after_days} dias) e ainda não marcou.
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/painel/clientes?filtro=${f.key}`}
            className={`shrink-0 rounded-full border px-3 py-1 ${
              f.key === filter ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {f.label} ({counts[f.key]})
          </Link>
        ))}
      </div>

      <form className="flex gap-2">
        <input type="hidden" name="filtro" value={filter} />
        <input
          name="busca"
          defaultValue={search}
          placeholder="Buscar por nome ou telefone"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button className="rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">Buscar</button>
      </form>

      {list.length === 0 && (
        <p className="text-sm text-neutral-500">
          {filter === "sumidos" ? "Ninguém sumido por enquanto. 🎉" : "Nenhum cliente aqui."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {list.map(({ c, st }) => {
          const since = daysSince(c.last_visit_at);
          const msg =
            filter === "aniversario" ? birthdayMessage(c, salon.name, link) : comeBackMessage(c, salon.name, link);
          return (
            <li key={c.client_id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/painel/clientes/${c.client_id}`} className="min-w-0">
                    <p className="truncate font-semibold">{c.name ?? c.phone}</p>
                    <p className="text-xs text-neutral-500">
                      {c.visits} visita(s)
                      {since !== null ? ` · última há ${since} dia(s)` : ""}
                      {c.return_every_days ? ` · volta a cada ${c.return_every_days} dias` : ""}
                      {c.total_spent_cents ? ` · ${formatPrice(c.total_spent_cents)}` : ""}
                    </p>
                  </Link>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${LEAD_LABEL[st].cls}`}>
                    {LEAD_LABEL[st].label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.accepts_marketing && (st === "sumido" || st === "vencendo" || filter === "aniversario") && (
                    <a
                      href={whatsappLink(c.phone, msg)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                    >
                      {filter === "aniversario" ? "Dar parabéns" : "Chamar de volta"}
                    </a>
                  )}
                  <Link
                    href={`/painel/clientes/${c.client_id}`}
                    className="rounded-lg border border-neutral-300 px-3 py-1 text-xs dark:border-neutral-700"
                  >
                    Ver histórico
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

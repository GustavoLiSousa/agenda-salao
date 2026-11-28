import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Auditoria | Agenda Salão" };

type Log = {
  id: number;
  actor_label: string;
  actor_kind: "dono" | "equipe" | "cliente" | "sistema";
  action: "criou" | "alterou" | "apagou";
  entity: string;
  entity_id: string | null;
  details: { antes?: Record<string, unknown>; depois?: Record<string, unknown> };
  created_at: string;
};

const ENTITY: Record<string, string> = {
  appointments: "Agendamento",
  clients: "Cliente",
  services: "Serviço",
  professionals: "Profissional",
  professional_services: "Serviço do profissional",
  working_hours: "Horário de trabalho",
  time_blocks: "Folga / bloqueio",
  packages: "Pacote",
  package_items: "Item do pacote",
  client_packages: "Pacote do cliente",
  package_uses: "Uso de pacote",
  package_requests: "Pedido de pacote",
  reviews: "Avaliação",
  salon_members: "Acesso da equipe",
  salon_join_requests: "Pedido para entrar na equipe",
  salons: "Dados do salão",
  deposit_rules: "Regra de sinal",
  payments: "Pagamento",
};

const FIELD: Record<string, string> = {
  status: "situação",
  starts_at: "início",
  ends_at: "fim",
  price_cents: "preço",
  name: "nome",
  phone: "telefone",
  notes: "observações",
  active: "ativo",
  duration_min: "duração",
  permissions: "permissões",
  role: "função",
  reason: "motivo",
  reply: "resposta",
  hidden: "oculta",
  archived_at: "arquivado",
  cancelled_at: "desmarcado em",
  cancel_reason: "motivo do cancelamento",
  professional_id: "profissional",
  service_id: "serviço",
  used: "usadas",
  quantity: "quantidade",
  return_every_days: "retorno (dias)",
  birthday: "aniversário",
  whatsapp: "WhatsApp",
  address: "endereço",
  logo_url: "logo",
  cover_url: "capa",
  description: "descrição",
  category: "categoria",
};

const STATUS: Record<string, string> = {
  confirmed: "confirmado",
  completed: "atendido",
  cancelled: "desmarcado",
  no_show: "faltou",
  pending: "pendente",
  approved: "aprovado",
  declined: "recusado",
  active: "ativo",
};

const KIND: Record<Log["actor_kind"], { label: string; cls: string }> = {
  dono: { label: "Dono", cls: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200" },
  equipe: { label: "Equipe", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  cliente: { label: "Cliente", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  sistema: { label: "Link / sistema", cls: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
};

const ACTION_CLS: Record<Log["action"], string> = {
  criou: "text-emerald-700 dark:text-emerald-400",
  alterou: "text-amber-700 dark:text-amber-400",
  apagou: "text-red-600 dark:text-red-400",
};

const HIDDEN = new Set(["id", "salon_id", "created_at", "client_id", "user_id", "package_id", "client_package_id"]);

function show(key: string, v: unknown, tz: string): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (key === "status" && typeof v === "string") return STATUS[v] ?? v;
  if (key.endsWith("_cents") && typeof v === "number") return `R$ ${(v / 100).toFixed(2).replace(".", ",")}`;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v))
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(
      new Date(v),
    );
  if (Array.isArray(v)) return v.join(", ") || "nenhuma";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v).slice(0, 80);
}

function summary(l: Log, tz: string) {
  const d = l.details;
  if (l.action === "alterou" && d.antes && d.depois) {
    return Object.keys(d.depois)
      .filter((k) => !HIDDEN.has(k))
      .map((k) => `${FIELD[k] ?? k}: ${show(k, d.antes![k], tz)} → ${show(k, d.depois![k], tz)}`);
  }
  const row = d.depois ?? d.antes ?? {};
  return ["name", "starts_at", "status", "price_cents", "reason", "comment", "salon_rating", "role"]
    .filter((k) => k in row && row[k] !== null)
    .map((k) => `${FIELD[k] ?? k}: ${show(k, row[k], tz)}`);
}

const PERIODS = { "1": "Hoje", "7": "7 dias", "30": "30 dias", "90": "90 dias" } as const;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ quem?: string; o_que?: string; periodo?: string; pagina?: string }>;
}) {
  const q = await searchParams;
  const { supabase, membership } = await requireOwner();
  const tz = membership.salon.timezone;
  const period = q.periodo && q.periodo in PERIODS ? q.periodo : "7";
  const page = Math.max(0, Number(q.pagina ?? 0) || 0);
  const size = 50;
  const since = new Date(Date.now() - Number(period) * 86_400_000).toISOString();

  let query = supabase
    .from("audit_logs")
    .select("id, actor_label, actor_kind, action, entity, entity_id, details, created_at", { count: "exact" })
    .eq("salon_id", membership.salon.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  if (q.quem && q.quem in KIND) query = query.eq("actor_kind", q.quem);
  if (q.o_que && q.o_que in ENTITY) query = query.eq("entity", q.o_que);
  const { data, count } = await query.returns<Log[]>();

  const href = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const all = { quem: q.quem, o_que: q.o_que, periodo: period, ...p };
    for (const [k, v] of Object.entries(all)) if (v) s.set(k, v);
    return `/painel/auditoria?${s}`;
  };
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
      on
        ? "border-transparent bg-[linear-gradient(110deg,#c026d3,#f43f5e)] text-white"
        : "border-stone-300 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
    }`;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    }).format(new Date(iso));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="Auditoria"
        subtitle="Tudo o que foi criado, alterado ou apagado no salão, por quem e quando."
      />

      <div className="flex flex-col gap-2">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          {Object.entries(PERIODS).map(([k, v]) => (
            <Link key={k} href={href({ periodo: k, pagina: undefined })} className={chip(period === k)}>
              {v}
            </Link>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          <Link href={href({ quem: undefined, pagina: undefined })} className={chip(!q.quem)}>
            Todos
          </Link>
          {Object.entries(KIND).map(([k, v]) => (
            <Link key={k} href={href({ quem: k, pagina: undefined })} className={chip(q.quem === k)}>
              {v.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          {q.quem && <input type="hidden" name="quem" value={q.quem} />}
          <input type="hidden" name="periodo" value={period} />
          <select
            name="o_que"
            defaultValue={q.o_que ?? ""}
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            <option value="">Tudo</option>
            {Object.entries(ENTITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="rounded-xl border border-stone-300 px-4 text-sm font-medium dark:border-stone-700">
            Filtrar
          </button>
        </form>
        <p className="text-xs text-stone-500">{count ?? 0} registro(s)</p>
      </div>

      <Card className="p-0">
        {(data ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">Nenhum registro neste filtro.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {(data ?? []).map((l) => {
              const lines = summary(l, tz);
              return (
                <li key={l.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-xs tabular-nums text-stone-500">{fmt(l.created_at)}</span>
                    <Badge className={KIND[l.actor_kind].cls}>{KIND[l.actor_kind].label}</Badge>
                    <span className="font-medium">{l.actor_label}</span>
                    <span className={`font-semibold ${ACTION_CLS[l.action]}`}>{l.action}</span>
                    <span>{ENTITY[l.entity] ?? l.entity}</span>
                  </div>
                  {lines.length > 0 && (
                    <ul className="text-xs text-stone-600 dark:text-stone-400">
                      {lines.slice(0, 6).map((t) => (
                        <li key={t} className="truncate">
                          • {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex justify-between text-sm">
        {page > 0 ? (
          <Link href={href({ pagina: String(page - 1) })} className="text-brand-700 dark:text-brand-300">
            ‹ Mais recentes
          </Link>
        ) : (
          <span />
        )}
        {(count ?? 0) > (page + 1) * size && (
          <Link href={href({ pagina: String(page + 1) })} className="text-brand-700 dark:text-brand-300">
            Mais antigos ›
          </Link>
        )}
      </div>
    </main>
  );
}

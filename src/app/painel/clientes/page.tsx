import { headers } from "next/headers";
import { Button, Field, Notice, PageHeader } from "@/components/ui";
import { isBirthdayMonth, leadStatus, type ClientStats } from "@/lib/clients";
import { requireSalon } from "@/lib/session";
import { createClientManual } from "./actions";
import { ClientList } from "./client-list";

export const metadata = { title: "Clientes | Agenda Salão" };

const FILTER_KEYS = ["todos", "voltar", "agendados", "aniversario", "novos"] as const;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; novo?: string; erro?: string }>;
}) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;

  const { data } = await supabase.from("client_stats").select("*").eq("salon_id", salon.id).returns<ClientStats[]>();
  const all = data ?? [];

  const h = await headers();
  const link = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}/${salon.slug}/agendar`;
  const month = new Date().getMonth() + 1;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const items = all.map((c) => ({
    c,
    st: leadStatus(c, salon.inactive_after_days),
    birthdayMonth: isBirthdayMonth(c, month),
    isNew: Date.parse(c.created_at) >= monthStart,
  }));
  const late = items.filter((x) => x.st === "sumido" || x.st === "vencendo").length;
  const filtro = q.filtro === "sumidos" ? "voltar" : q.filtro;
  const initialFilter = (FILTER_KEYS as readonly string[]).includes(filtro ?? "")
    ? (filtro as (typeof FILTER_KEYS)[number])
    : "todos";

  return (
    <main className="flex flex-col gap-4">
      <PageHeader
        title="Clientes"
        subtitle={`${all.length} cadastrado${all.length === 1 ? "" : "s"}${late ? ` · ${late} para chamar de volta` : ""}`}
      />

      <details open={!!q.novo} className="group rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium sm:px-5">
          + Cadastrar cliente
          <span className="text-stone-400 transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-stone-100 p-4 sm:p-5 dark:border-stone-800">
          {q.erro && <div className="mb-3"><Notice kind="error">{q.erro}</Notice></div>}
          <form action={createClientManual} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" name="name" required />
            <Field label="WhatsApp" name="phone" type="tel" inputMode="tel" placeholder="11 99999-9999" required />
            <Field label="Aniversário (opcional)" name="birthday" type="date" />
            <Field label="Volta a cada (dias, opcional)" name="return_every_days" type="number" min={1} max={365} placeholder="15" />
            <Button className="sm:col-span-2 sm:justify-self-start">Cadastrar</Button>
          </form>
        </div>
      </details>

      <ClientList items={items} salonName={salon.name} bookingLink={link} initialFilter={initialFilter} />
      <p className="text-center text-xs text-stone-400">
        &quot;Chamar de volta&quot; = passou do tempo de voltar (do cliente, do serviço ou {salon.inactive_after_days} dias) e não marcou.
      </p>
    </main>
  );
}

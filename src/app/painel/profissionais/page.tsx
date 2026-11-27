import Link from "next/link";
import { Avatar, Button, Card, Field, Notice } from "@/components/ui";
import { requireOwner } from "@/lib/session";
import type { Professional } from "@/lib/types";
import { createProfessional } from "./actions";
import { JoinRequestCard, type JoinRequest } from "./team-access";

export const metadata = { title: "Profissionais | Agenda Salão" };

export default async function ProfissionaisPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const { supabase, membership } = await requireOwner();
  const { data: pros } = await supabase
    .from("professionals")
    .select("*")
    .eq("salon_id", membership.salon.id)
    .is("archived_at", null)
    .order("active", { ascending: false })
    .order("sort_order")
    .order("name")
    .returns<Professional[]>();
  const [{ data: requests }, { data: members }] = await Promise.all([
    supabase
      .from("salon_join_requests")
      .select("id, name, phone, email, created_at")
      .eq("salon_id", membership.salon.id)
      .eq("status", "pending")
      .order("created_at")
      .returns<JoinRequest[]>(),
    supabase
      .from("salon_members")
      .select("professional_id")
      .eq("salon_id", membership.salon.id)
      .eq("role", "professional"),
  ]);
  const withAccess = new Set((members ?? []).map((m) => m.professional_id as string));
  const withoutAccess = (pros ?? []).filter((p) => !withAccess.has(p.id));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="font-display text-3xl font-semibold">Equipe</h1>
      {erro && <Notice kind="error">{erro}</Notice>}
      {ok === "excluido" && <Notice kind="success">Profissional excluído.</Notice>}
      {ok === "recusado" && <Notice>Pedido recusado.</Notice>}

      {(requests ?? []).length > 0 && (
        <section id="pedidos" className="flex scroll-mt-20 flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Pedidos para entrar na equipe</h2>
          {(requests ?? []).map((r) => (
            <JoinRequestCard key={r.id} r={r} pros={withoutAccess} tz={membership.salon.timezone} />
          ))}
        </section>
      )}

      <Card>
        <form action={createProfessional} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Novo profissional" name="name" placeholder="Nome" required />
          </div>
          <Button>Adicionar</Button>
        </form>
        <p className="mt-2 text-xs text-stone-500">
          Ele já começa com todos os serviços e horário de terça a sábado. Você ajusta em seguida.
        </p>
      </Card>

      <ul className="flex flex-col gap-2">
        {(pros ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/painel/profissionais/${p.id}`}>
              <Card className={`flex items-center gap-3 transition hover:border-stone-400 ${p.active ? "" : "opacity-60"}`}>
                <Avatar name={p.name} src={p.photo_url} size={44} />
                <div className="flex-1">
                  <p className="font-medium">
                    {p.name} {!p.active && <span className="text-xs">(inativo)</span>}
                    {withAccess.has(p.id) && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        usa o app
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    {p.release_mode === "weekly"
                      ? "Agenda abre uma vez por semana"
                      : `Agenda aberta para os próximos ${p.release_days_ahead} dias`}
                  </p>
                </div>
                <span className="text-stone-400">›</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

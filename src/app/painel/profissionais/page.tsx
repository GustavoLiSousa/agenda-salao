import Link from "next/link";
import { Avatar, Button, Card, Field, Notice } from "@/components/ui";
import { requireSalon } from "@/lib/session";
import type { Professional } from "@/lib/types";
import { createProfessional } from "./actions";

export const metadata = { title: "Profissionais | Agenda Salão" };

export default async function ProfissionaisPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  const { supabase, membership } = await requireSalon();
  const { data: pros } = await supabase
    .from("professionals")
    .select("*")
    .eq("salon_id", membership.salon.id)
    .is("archived_at", null)
    .order("active", { ascending: false })
    .order("sort_order")
    .order("name")
    .returns<Professional[]>();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="font-display text-3xl font-semibold">Equipe</h1>
      {erro && <Notice kind="error">{erro}</Notice>}
      {ok === "excluido" && <Notice kind="success">Profissional excluído.</Notice>}

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

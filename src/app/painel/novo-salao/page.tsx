import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, Button, Card, Field, Notice } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { cancelJoin, requestJoin } from "./actions";
import { NewSalonForm } from "./form";

export const metadata = { title: "Começar | Agenda Salão" };

type JoinRequest = {
  id: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  created_at: string;
  salon: { name: string; slug: string; logo_url: string | null } | null;
};

export default async function NovoSalaoPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; busca?: string; erro?: string; ok?: string }>;
}) {
  const q = await searchParams;
  const { supabase, user, membership } = await requireUser();
  if (membership) redirect("/painel");

  const { data: requests } = await supabase
    .from("salon_join_requests")
    .select("id, status, created_at, salon:salons(name, slug, logo_url)")
    .eq("user_id", user.id)
    .in("status", ["pending", "declined"])
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<JoinRequest[]>();
  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const equipe = q.modo === "equipe" || pending.length > 0;

  const busca = (q.busca ?? "").trim();
  const { data: salons } =
    equipe && busca.length >= 2
      ? await supabase
          .from("salons")
          .select("id, name, slug, logo_url, address")
          .or(`name.ilike.%${busca.replace(/[%,()]/g, " ")}%,slug.ilike.%${busca.replace(/[%,()]/g, " ")}%`)
          .order("name")
          .limit(10)
          .returns<{ id: string; name: string; slug: string; logo_url: string | null; address: string | null }[]>()
      : { data: null };
  const myName = (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Vamos começar</h1>
        <p className="text-sm text-stone-500">Você é dono de um salão ou trabalha em um?</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 text-center text-sm font-medium dark:bg-stone-800">
        <Link
          href="/painel/novo-salao"
          className={`rounded-lg py-2 ${!equipe ? "bg-white shadow dark:bg-stone-950" : ""}`}
        >
          Criar meu salão
        </Link>
        <Link
          href="/painel/novo-salao?modo=equipe"
          className={`rounded-lg py-2 ${equipe ? "bg-white shadow dark:bg-stone-950" : ""}`}
        >
          Trabalho em um salão
        </Link>
      </div>

      {!equipe ? (
        <>
          <p className="text-sm text-stone-500">
            Leva 1 minuto. Depois você adiciona serviços, profissionais e horários.
          </p>
          <NewSalonForm />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {q.erro && <Notice kind="error">{q.erro}</Notice>}
          {q.ok && <Notice>Pedido enviado! Assim que o dono aprovar, você entra direto na sua agenda.</Notice>}

          {pending.length > 0 && (
            <Card className="flex flex-col gap-3 border-brand-300 dark:border-brand-800">
              <h2 className="font-display text-lg font-semibold">Aguardando aprovação</h2>
              {pending.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <Avatar name={r.salon?.name ?? ""} src={r.salon?.logo_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.salon?.name}</p>
                    <p className="text-xs text-stone-500">O dono vai ver o seu pedido no painel dele.</p>
                  </div>
                  <form action={cancelJoin}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-red-600 hover:underline">Cancelar</button>
                  </form>
                </div>
              ))}
              <Link href="/painel" className="text-sm text-brand-700 dark:text-brand-300">
                Já fui aprovado? Toque aqui para entrar ›
              </Link>
            </Card>
          )}
          {(requests ?? [])
            .filter((r) => r.status === "declined")
            .slice(0, 1)
            .map((r) => (
              <Notice key={r.id} kind="error">
                O dono do {r.salon?.name} recusou o seu pedido. Fale com ele se achar que foi engano.
              </Notice>
            ))}

          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Procure o salão onde você trabalha</h2>
            <form className="flex gap-2">
              <input type="hidden" name="modo" value="equipe" />
              <div className="flex-1">
                <Field label="Nome do salão" name="busca" defaultValue={busca} placeholder="Ex.: Barbearia do Zé" />
              </div>
              <Button className="self-end">Buscar</Button>
            </form>
            {busca.length >= 2 && (salons ?? []).length === 0 && (
              <p className="text-sm text-stone-500">Nenhum salão encontrado. Confira o nome com o dono.</p>
            )}
            <ul className="flex flex-col gap-3">
              {(salons ?? []).map((s) => (
                <li key={s.id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} src={s.logo_url} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-stone-500">{s.address ?? `/${s.slug}`}</p>
                    </div>
                  </div>
                  <form action={requestJoin} className="mt-3 flex flex-col gap-2">
                    <input type="hidden" name="salon_id" value={s.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Seu nome" name="name" defaultValue={myName} required />
                      <Field label="Seu WhatsApp" name="phone" type="tel" inputMode="tel" placeholder="11 99999-9999" />
                    </div>
                    <Button>Pedir para entrar na equipe</Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </main>
  );
}

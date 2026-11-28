import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Badge, Button, Card, Field, Notice, PageHeader, Select } from "@/components/ui";
import { whatsappLink } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createInvite, revokeInvite } from "./actions";

export const metadata = { title: "Convites | Agenda Salão" };

type Invite = {
  code: string;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  used_at: string | null;
  salon: { name: string; slug: string } | null;
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

export default async function ConvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; erro?: string }>;
}) {
  const q = await searchParams;
  const { supabase } = await requireUser();
  const { data: admin } = await supabase.rpc("is_platform_admin");
  if (!admin) redirect("/painel");

  const { data } = await supabase
    .from("salon_invite_codes")
    .select("code, note, created_at, expires_at, revoked_at, used_at, salon:salons(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Invite[]>();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const message = (code: string) =>
    `Olá! Aqui está o seu convite para cadastrar o seu salão no Agenda Salão.\n\n1. Entre em ${origin}/entrar?aba=gestao e crie sua conta\n2. Toque em "Tenho um convite"\n3. Use o código: ${code}`;
  const now = new Date().toISOString();
  const status = (i: Invite) =>
    i.used_at
      ? { label: "Usado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" }
      : i.revoked_at
        ? { label: "Cancelado", cls: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300" }
        : i.expires_at && i.expires_at < now
          ? { label: "Vencido", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" }
          : { label: "Disponível", cls: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200" };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageHeader title="Convites" subtitle="Só cria salão na plataforma quem recebe um código seu." />
      {q.erro && <Notice kind="error">{q.erro}</Notice>}
      {q.novo && (
        <Card className="flex flex-col items-center gap-3 border-fuchsia-300 text-center dark:border-fuchsia-800">
          <p className="text-sm text-stone-500">Código criado</p>
          <p className="font-mono text-4xl font-bold tracking-[0.2em]">{q.novo}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton text={q.novo} label="Copiar código" />
            <a
              href={whatsappLink(null, message(q.novo))}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white"
            >
              Enviar no WhatsApp
            </a>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-display text-lg font-semibold">Gerar novo código</h2>
        <form action={createInvite} className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Para quem (opcional)" name="note" placeholder="Barbearia do João" />
          <Select label="Validade" name="days" defaultValue="30">
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="0">Sem prazo</option>
          </Select>
          <Button className="sm:col-span-2 sm:justify-self-start">Gerar código</Button>
        </form>
      </Card>

      <Card className="p-0">
        <h2 className="border-b border-stone-100 px-4 py-3 font-display text-lg font-semibold dark:border-stone-800">
          Códigos gerados
        </h2>
        {(data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">Nenhum código ainda.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {(data ?? []).map((i) => {
              const st = status(i);
              return (
                <li key={i.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold tracking-wider">{i.code}</span>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-stone-500">
                      {i.note ? `${i.note} · ` : ""}criado em {fmt(i.created_at)}
                      {i.expires_at && !i.used_at ? ` · vale até ${fmt(i.expires_at)}` : ""}
                      {i.salon ? ` · virou o salão ${i.salon.name}` : ""}
                    </p>
                  </div>
                  {st.label === "Disponível" && (
                    <div className="flex gap-2">
                      <a
                        href={whatsappLink(null, message(i.code))}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-emerald-600/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        WhatsApp
                      </a>
                      <form action={revokeInvite}>
                        <input type="hidden" name="code" value={i.code} />
                        <button className="rounded-lg px-2.5 py-1 text-xs text-red-600 hover:underline">
                          Cancelar
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}

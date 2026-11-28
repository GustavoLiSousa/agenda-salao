import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageInput } from "@/components/image-input";
import { Button, Card, Field, Notice } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { saveClientProfile } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu perfil", robots: { index: false } };

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const q = await searchParams;
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/minha-conta/entrar?next=/minha-conta/perfil");
  const m = (user.user_metadata ?? {}) as Record<string, string | null | undefined>;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-6 pb-16">
      <Link href="/minha-conta" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
        ‹ Central do cliente
      </Link>
      <div>
        <h1 className="font-display text-3xl font-semibold">Meu perfil</h1>
        <p className="mt-1 text-sm text-stone-500">Seus dados ajudam o salão a te reconhecer na hora de agendar.</p>
      </div>
      {q.ok && <Notice kind="success">Perfil salvo.</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <Card>
        <form action={saveClientProfile} className="flex flex-col gap-4">
          <div className="mx-auto w-36">
            <ImageInput
              name="photo"
              label="Foto"
              current={m.avatar_url ?? null}
              aspect="aspect-square"
              removeName="remove_photo"
            />
          </div>
          <Field label="Nome" name="name" defaultValue={m.full_name ?? m.name ?? ""} required />
          <Field
            label="WhatsApp"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="11 99999-9999"
            defaultValue={m.phone ?? ""}
          />
          <Field label="Aniversário" name="birthday" type="date" defaultValue={m.birthday ?? ""} />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-stone-700 dark:text-stone-300">E-mail de acesso</span>
            <span className="truncate text-stone-500">{user.email}</span>
          </div>
          <Button>Salvar perfil</Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Senha</h2>
        <p className="text-sm text-stone-500">Crie ou troque a senha para entrar mais rápido.</p>
        <Link
          href="/minha-conta/criar-senha?next=/minha-conta/perfil"
          className="self-start rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium dark:border-stone-700"
        >
          Trocar senha
        </Link>
      </Card>

      <Card className="flex flex-col gap-2 opacity-70">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Pagamentos</h2>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            Em breve
          </span>
        </div>
        <p className="text-sm text-stone-500">
          Aqui você vai poder salvar um cartão ou Pix para pagar pacotes e horários direto pelo app.
        </p>
      </Card>
    </main>
  );
}

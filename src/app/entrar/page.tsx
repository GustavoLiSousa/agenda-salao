import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Agenda Salão" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; confirmado?: string }>;
}) {
  const { erro, confirmado } = await searchParams;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/painel");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900 font-display text-xl font-semibold text-brand-300 dark:bg-stone-100 dark:text-brand-700">
          A
        </span>
        <h1 className="font-display text-3xl font-semibold">Área do salão</h1>
        <p className="text-sm text-stone-500">
          Para donos e profissionais. Clientes agendam pelo link do salão.
        </p>
      </div>
      {!isSupabaseConfigured() && (
        <Notice kind="error">
          O banco de dados ainda não foi configurado (veja o README).
        </Notice>
      )}
      {confirmado && !erro && (
        <Notice kind="success">
          E-mail confirmado! Agora é só entrar com seu e-mail e senha.
        </Notice>
      )}
      {erro && (
        <Notice kind="error">
          Não foi possível confirmar o seu e-mail. Tente entrar ou peça um novo link.
        </Notice>
      )}
      <AuthForm />
    </main>
  );
}

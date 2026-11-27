import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/client-area";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { CreatePasswordForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar senha | Meus agendamentos", robots: { index: false } };

export default async function CriarSenhaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/minha-conta/entrar?next=${encodeURIComponent(next)}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-5 py-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">
          {data.user.user_metadata?.has_password ? "Escolha uma nova senha" : "Crie sua senha"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Da próxima vez, é só entrar com <b>{data.user.email}</b> e esta senha, sem esperar código.
        </p>
      </div>
      <CreatePasswordForm next={next} />
      <Link href={next} className="text-center text-sm text-stone-500 underline-offset-4 hover:underline">
        Agora não
      </Link>
    </main>
  );
}

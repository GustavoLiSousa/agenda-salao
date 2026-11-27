import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { safeNext } from "@/lib/client-area";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ClientLogin } from "./client-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus agendamentos | Entrar", robots: { index: false } };

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const q = await searchParams;
  const next = safeNext(q.next);
  const salonSlug = new URL(next, "http://x").searchParams.get("salao");

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-5 py-8">
      {salonSlug && (
        <Link href={`/${salonSlug}`} className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
          ‹ Voltar ao salão
        </Link>
      )}
      <div>
        <h1 className="font-display text-3xl font-semibold">Meus agendamentos</h1>
        <p className="mt-1 text-sm text-stone-500">
          Entre para ver, remarcar ou desmarcar seus horários.
        </p>
      </div>
      {q.erro && <Notice kind="error">{q.erro === "1" ? "Não foi possível entrar. Tente de novo." : q.erro}</Notice>}
      <ClientLogin next={next} />
    </main>
  );
}

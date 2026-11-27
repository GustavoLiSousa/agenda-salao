import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Agenda Salão" };
export const viewport = { themeColor: "#0c0a09" };

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
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-stone-950 text-stone-100">
      {/* brilho dourado e textura sutil ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(214,181,125,0.22), transparent 60%), radial-gradient(80% 50% at 100% 100%, rgba(148,107,52,0.16), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(70% 50% at 50% 20%, black, transparent)",
          WebkitMaskImage: "radial-gradient(70% 50% at 50% 20%, black, transparent)",
        }}
      />

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-300/30 bg-gradient-to-b from-stone-800 to-stone-900 font-display text-3xl font-semibold text-brand-300 shadow-[0_10px_40px_-10px_rgba(214,181,125,0.45)]">
            A
          </span>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.32em] text-brand-300/80">Agenda Salão</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Área do salão</h1>
          <div className="my-4 flex items-center gap-3 text-brand-300/60" aria-hidden>
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-brand-300/50" />
            <span className="text-xs">✦</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-brand-300/50" />
          </div>
          <p className="text-sm leading-relaxed text-stone-400">
            Para donos e profissionais.
            <br />
            Gerencie a agenda, os clientes e a equipe.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {!isSupabaseConfigured() && (
            <Banner kind="error">O banco de dados ainda não foi configurado (veja o README).</Banner>
          )}
          {confirmado && !erro && (
            <Banner kind="success">E-mail confirmado! Agora é só entrar com seu e-mail e senha.</Banner>
          )}
          {erro && (
            <Banner kind="error">Não foi possível confirmar o seu e-mail. Tente entrar ou peça um novo link.</Banner>
          )}
          <AuthForm />
        </div>

        <p className="mt-8 text-center text-sm text-stone-500">
          É cliente?{" "}
          <Link href="/minha-conta" className="font-medium text-brand-300 underline-offset-4 hover:underline">
            Veja seus agendamentos
          </Link>
        </p>
      </div>
    </main>
  );
}

function Banner({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm ${
        kind === "error"
          ? "border-red-400/30 bg-red-500/10 text-red-200"
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      }`}
    >
      {children}
    </p>
  );
}

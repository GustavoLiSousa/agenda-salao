import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";
import { ClientLogin } from "@/app/minha-conta/entrar/client-login";
import { BrandMark } from "@/components/brand-mark";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Agenda Salão" };
export const viewport = { themeColor: "#0c0a09" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; confirmado?: string; aba?: string; next?: string }>;
}) {
  const { erro, confirmado, aba, next: rawNext } = await searchParams;
  const cliente = aba === "cliente";
  const next = safeNext(rawNext);
  const salonSlug = cliente ? new URL(next, "http://x").searchParams.get("salao") : null;
  const tab = (a: "cliente" | "gestao") =>
    a === "cliente" ? `/entrar?aba=cliente${rawNext ? `&next=${encodeURIComponent(next)}` : ""}` : "/entrar?aba=gestao";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(cliente ? next : "/painel");
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
          <span className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-brand-300/25 bg-gradient-to-b from-stone-800/90 to-stone-950 shadow-[0_14px_50px_-12px_rgba(214,181,125,0.5)]">
            <BrandMark className="h-16 w-16" title="Agenda Salão" />
          </span>
          {cliente ? (
            <>
              <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.32em] text-brand-300/80">Agenda Salão</p>
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Meus horários</h1>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">Agenda Salão</h1>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.28em] text-brand-300/85">
                Gestão para seu salão / Estúdio
              </p>
            </>
          )}
          <div className="my-4 flex items-center gap-3 text-brand-300/60" aria-hidden>
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-brand-300/50" />
            <span className="text-xs">✦</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-brand-300/50" />
          </div>
          <p className="text-sm leading-relaxed text-stone-400">
            {cliente ? (
              <>
                Para clientes: veja, remarque ou desmarque seus horários.
                <br />
                Para marcar um horário não precisa de conta.
              </>
            ) : (
              <>
                Para donos e profissionais.
                <br />
                Gerencie a agenda, os clientes e a equipe.
              </>
            )}
          </p>
        </div>

        <nav className="mt-8 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1 text-sm font-medium">
          {(["cliente", "gestao"] as const).map((a) => {
            const active = (a === "cliente") === cliente;
            return (
              <Link
                key={a}
                href={tab(a)}
                replace
                aria-current={active ? "page" : undefined}
                className={`rounded-xl py-2.5 text-center transition ${
                  active
                    ? "bg-gradient-to-b from-brand-200 to-brand-400 text-stone-950 shadow"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                {a === "cliente" ? "Sou cliente" : "Gestão do salão"}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {!isSupabaseConfigured() && (
            <Banner kind="error">O banco de dados ainda não foi configurado (veja o README).</Banner>
          )}
          {cliente ? (
            <>
              {erro && (
                <div className="mb-4">
                  <Banner kind="error">{erro === "1" ? "Não foi possível entrar. Tente de novo." : erro}</Banner>
                </div>
              )}
              <ClientLogin next={next} />
            </>
          ) : (
            <>
              {confirmado && !erro && (
                <Banner kind="success">E-mail confirmado! Agora é só entrar com seu e-mail e senha.</Banner>
              )}
              {erro && (
                <Banner kind="error">
                  Não foi possível confirmar o seu e-mail. Tente entrar ou peça um novo link.
                </Banner>
              )}
              <AuthForm />
            </>
          )}
        </div>

        {salonSlug && (
          <p className="mt-8 text-center text-sm">
            <Link
              href={`/${salonSlug}`}
              className="text-stone-500 underline-offset-4 hover:text-stone-300 hover:underline"
            >
              ‹ Voltar ao salão
            </Link>
          </p>
        )}
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

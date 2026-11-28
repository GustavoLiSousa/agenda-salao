import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";
import { ClientLogin } from "@/app/minha-conta/entrar/client-login";
import { BrandMark } from "@/components/brand-mark";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Agenda Salão" };
export const viewport = { themeColor: "#0b0618" };

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
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#0b0618] text-stone-100">
      {/* aurora colorida animada ao fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora-a absolute -left-1/4 -top-1/4 h-[70vh] w-[90vw] rounded-full bg-[radial-gradient(closest-side,rgba(192,38,211,0.55),transparent)] blur-3xl" />
        <div className="aurora-b absolute -right-1/4 top-1/4 h-[60vh] w-[80vw] rounded-full bg-[radial-gradient(closest-side,rgba(244,63,94,0.45),transparent)] blur-3xl" />
        <div className="aurora-a absolute -bottom-1/4 left-0 h-[55vh] w-[80vw] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.5),transparent)] blur-3xl [animation-delay:-6s]" />
        <div className="aurora-b absolute bottom-0 right-0 h-[40vh] w-[50vw] rounded-full bg-[radial-gradient(closest-side,rgba(251,146,60,0.35),transparent)] blur-3xl [animation-delay:-9s]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(80% 60% at 50% 30%, black, transparent)",
            WebkitMaskImage: "radial-gradient(80% 60% at 50% 30%, black, transparent)",
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <div className="rise-in flex flex-col items-center text-center">
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-[2rem] bg-[conic-gradient(from_0deg,#c026d3,#f43f5e,#fb923c,#a855f7,#c026d3)] opacity-90 blur-[2px]" />
            <span className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-[1.8rem] bg-[#140b26] shadow-[0_18px_60px_-10px_rgba(217,70,239,0.7)]">
              <BrandMark className="h-16 w-16" title="Agenda Salão" tone="vivid" />
            </span>
          </span>
          {cliente ? (
            <>
              <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.34em] text-fuchsia-200/80">
                Agenda Salão
              </p>
              <h1 className="text-shine mt-2 font-display text-5xl font-semibold tracking-tight">Meus horários</h1>
            </>
          ) : (
            <>
              <h1 className="text-shine mt-7 font-display text-5xl font-semibold tracking-tight">Agenda Salão</h1>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-fuchsia-200/85">
                Gestão para seu salão / Estúdio
              </p>
            </>
          )}
          <p className="mt-4 text-sm leading-relaxed text-violet-100/70">
            {cliente ? (
              <>
                Veja, remarque ou desmarque seus horários.
                <br />
                Para marcar um horário não precisa de conta.
              </>
            ) : (
              <>
                Para donos e profissionais.
                <br />
                Agenda, clientes e equipe na palma da mão.
              </>
            )}
          </p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-medium">
            {(cliente
              ? [
                  ["📅", "Seus horários"],
                  ["💈", "Seus salões"],
                  ["⭐", "Avaliações"],
                ]
              : [
                  ["📅", "Agenda online 24h"],
                  ["💬", "Lembretes no WhatsApp"],
                  ["🎁", "Fidelidade e pacotes"],
                ]
            ).map(([i, t]) => (
              <li
                key={t}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-violet-50/90 backdrop-blur"
              >
                <span aria-hidden>{i}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <nav className="rise-in mt-8 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1 text-sm font-medium backdrop-blur [animation-delay:120ms]">
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
                    ? "bg-[linear-gradient(110deg,#c026d3,#f43f5e_60%,#fb923c)] text-white shadow-lg shadow-fuchsia-900/40"
                    : "text-violet-200/70 hover:text-white"
                }`}
              >
                {a === "cliente" ? "Sou cliente" : "Gestão do salão"}
              </Link>
            );
          })}
        </nav>

        <div className="rise-in mt-4 rounded-3xl border border-white/15 bg-white/[0.06] p-5 shadow-2xl shadow-fuchsia-950/50 ring-1 ring-inset ring-white/5 backdrop-blur-2xl [animation-delay:220ms]">
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

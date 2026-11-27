import Link from "next/link";
import { ShareLink } from "@/components/share-link";
import { leadStatus, type ClientStats } from "@/lib/clients";
import { requireSalon } from "@/lib/session";

export const metadata = { title: "Painel | Agenda Salão" };

function dayRange(timezone: string, offsetDays = 0) {
  // início e fim do dia no fuso do salão
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const diff = now.getTime() - local.getTime();
  const start = new Date(local);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    from: new Date(start.getTime() + diff).toISOString(),
    to: new Date(end.getTime() + diff).toISOString(),
  };
}

export default async function PainelPage() {
  const { supabase, user, membership } = await requireSalon();
  const salon = membership.salon;
  const today = dayRange(salon.timezone);

  const [
    { count: todayCount },
    { count: servicesCount },
    { count: professionalsCount },
    { count: clientsCount },
    { count: freedCount },
    { data: stats },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "confirmed")
      .gte("starts_at", today.from)
      .lt("starts_at", today.to),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "cancelled")
      .gt("starts_at", new Date().toISOString())
      .gt("cancelled_at", new Date(Date.now() - 72 * 3_600_000).toISOString()),
    supabase.from("client_stats").select("*").eq("salon_id", salon.id).returns<ClientStats[]>(),
  ]);
  const comeBack = (stats ?? []).filter((c) => {
    const st = leadStatus(c, salon.inactive_after_days);
    return st === "sumido" || st === "vencendo";
  }).length;

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  const setup = [
    { done: (servicesCount ?? 0) > 0, label: "Cadastrar os serviços (corte, barba, manicure...)" },
    { done: (professionalsCount ?? 0) > 0, label: "Cadastrar os profissionais e seus horários" },
    { done: false, label: "Enviar o link para os clientes" },
  ];

  return (
    <main className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">Olá{firstName ? `, ${firstName}` : ""}!</p>
        <h1 className="text-2xl font-bold">{salon.name}</h1>
        <p className="text-xs uppercase tracking-wide text-violet-600">
          {membership.role === "owner" ? "Dono" : "Profissional"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { n: todayCount ?? 0, label: "horários hoje" },
          { n: clientsCount ?? 0, label: "clientes" },
          { n: professionalsCount ?? 0, label: "profissionais" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p className="text-2xl font-bold">{s.n}</p>
            <p className="text-xs text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      {(freedCount ?? 0) > 0 && (
        <Link
          href="/painel/agenda"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950"
        >
          <b>{freedCount} horário(s) liberado(s)</b> por clientes que desmarcaram. Toque para divulgar a vaga ›
        </Link>
      )}

      {comeBack > 0 && (
        <Link
          href="/painel/clientes"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950"
        >
          <b>{comeBack} cliente(s) para chamar de volta</b>: já passaram do tempo de voltar e não agendaram ›
        </Link>
      )}

      <Link
        href="/painel/agenda"
        className="rounded-xl bg-violet-600 p-3 text-center font-semibold text-white"
      >
        Ver agenda de hoje
      </Link>

      <ShareLink slug={salon.slug} salonName={salon.name} />

      {membership.role === "owner" && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-2 font-semibold">Primeiros passos</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {setup.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    s.done ? "bg-green-600 text-white" : "border border-neutral-400"
                  }`}
                >
                  {s.done ? "✓" : ""}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">
            Ajuste em <Link className="text-violet-600" href="/painel/servicos">Serviços</Link> e{" "}
            <Link className="text-violet-600" href="/painel/profissionais">Profissionais</Link>.
          </p>
        </section>
      )}
    </main>
  );
}

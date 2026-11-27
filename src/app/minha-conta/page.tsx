import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Notice } from "@/components/ui";
import { claimTokens, readBookingTokens, type MyAppointment } from "@/lib/client-area";
import { formatPrice, whatsappLink } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatLongDate, formatTime } from "@/lib/time";
import { clientSignOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus agendamentos", robots: { index: false } };

const STATUS: Record<MyAppointment["status"], { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  completed: { label: "Atendido", className: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300" },
  cancelled: { label: "Desmarcado", className: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400" },
  no_show: { label: "Não compareceu", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export default async function MinhaContaPage({
  searchParams,
}: {
  searchParams: Promise<{ salao?: string; vincular?: string }>;
}) {
  const { salao, vincular } = await searchParams;
  const slug = salao && /^[a-z0-9-]{3,60}$/.test(salao) ? salao : null;
  const here = slug ? `/minha-conta?salao=${slug}` : "/minha-conta";
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/minha-conta/entrar?next=${encodeURIComponent(here)}`);

  // horários marcados neste aparelho antes de entrar passam a ser da conta
  // (e o do link aberto, quando veio da página de um agendamento)
  await claimTokens(supabase, [...(await readBookingTokens()), ...(vincular ? [vincular] : [])]);

  const [{ data }, { data: salon }] = await Promise.all([
    supabase.rpc("my_appointments_v2").returns<MyAppointment>(),
    slug
      ? supabase.from("salons").select("name, slug, logo_url").eq("slug", slug).maybeSingle<{ name: string; slug: string; logo_url: string | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const all = (data ?? []) as unknown as MyAppointment[];
  const now = Date.now();
  const upcoming = all
    .filter((a) => a.status === "confirmed" && new Date(a.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = all.filter((a) => !upcoming.includes(a)).slice(0, 30);
  const bookHref = salon ? `/${salon.slug}/agendar` : upcoming[0] ? `/${upcoming[0].salon_slug}/agendar` : past[0] ? `/${past[0].salon_slug}/agendar` : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-6 pb-16">
      <div className="flex items-center justify-between gap-3">
        {salon ? (
          <Link href={`/${salon.slug}`} className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
            ‹ {salon.name}
          </Link>
        ) : (
          <span />
        )}
        <form action={clientSignOut}>
          <input type="hidden" name="back" value={slug ? `/${slug}` : "/minha-conta/entrar"} />
          <button className="text-sm text-stone-500 underline-offset-4 hover:underline">Sair</button>
        </form>
      </div>

      <div>
        <h1 className="font-display text-3xl font-semibold">Meus agendamentos</h1>
        <p className="mt-1 truncate text-sm text-stone-500">{user.email}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Próximos</h2>
        {upcoming.length === 0 ? (
          <Card className="flex flex-col gap-3 text-sm text-stone-500">
            <p>Você não tem horários marcados.</p>
            {all.length === 0 && (
              <p>
                Já agendou antes de entrar? Abra o link que apareceu na confirmação do agendamento com esta conta
                aberta, e ele passa a aparecer aqui. Os próximos agendamentos feitos neste celular entram sozinhos.
              </p>
            )}
          </Card>
        ) : (
          upcoming.map((a) => <AppointmentCard key={a.manage_token} a={a} showSalon={!slug || a.salon_slug !== slug} />)
        )}
        {bookHref && (
          <Link
            href={bookHref}
            className="rounded-2xl bg-stone-900 p-4 text-center font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
          >
            Agendar novo horário
          </Link>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Anteriores</h2>
          <ul className="flex flex-col divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {past.map((a) => (
              <li key={a.manage_token}>
                <Link href={`/${a.salon_slug}/agendamento/${a.manage_token}${a.status === "completed" && !a.reviewed ? "#avaliar" : ""}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.service_name}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {formatLongDate(a.starts_at, a.salon_timezone)} · {a.professional_name}
                      {(!slug || a.salon_slug !== slug) && ` · ${a.salon_name}`}
                    </span>
                  </span>
                  {a.status === "completed" && !a.reviewed && new Date(a.starts_at).getTime() > Date.now() - 60 * 86_400_000 ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      ★ Avaliar
                    </span>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[a.status].className}`}>
                      {STATUS[a.status].label}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {all.length > 0 && upcoming.length === 0 && past.length === 0 && <Notice>Nada por aqui ainda.</Notice>}
    </main>
  );
}

function AppointmentCard({ a, showSalon }: { a: MyAppointment; showSalon: boolean }) {
  const tz = a.salon_timezone;
  const when = `${formatLongDate(a.starts_at, tz)} às ${formatTime(a.starts_at, tz)}`;
  const canChange = new Date(a.starts_at).getTime() - Date.now() >= a.cancel_min_hours * 3_600_000;
  const detail = `/${a.salon_slug}/agendamento/${a.manage_token}`;
  return (
    <Card className="flex flex-col gap-3">
      <Link href={detail} className="flex flex-col gap-0.5">
        {showSalon && <span className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">{a.salon_name}</span>}
        <span className="font-display text-xl font-semibold">{a.service_name}</span>
        <span className="font-medium first-letter:uppercase">{when}</span>
        <span className="text-sm text-stone-500">
          Com {a.professional_name} · {formatPrice(a.price_cents)}
        </span>
      </Link>
      <div className="flex flex-wrap gap-2">
        {canChange ? (
          <>
            <Link href={`/${a.salon_slug}/agendar?remarcar=${a.manage_token}`} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium dark:border-stone-700">
              Remarcar
            </Link>
            <Link href={`${detail}?desmarcar=1`} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-red-600 dark:border-stone-700">
              Desmarcar
            </Link>
          </>
        ) : (
          a.salon_whatsapp && (
            <a
              href={whatsappLink(a.salon_whatsapp, `Olá! Sobre meu horário de ${a.service_name} com ${a.professional_name} em ${when}.`)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white"
            >
              Falar com o salão
            </a>
          )
        )}
        <Link href={detail} className="rounded-xl px-2 py-2 text-sm text-stone-500 underline-offset-4 hover:underline">
          Detalhes
        </Link>
      </div>
    </Card>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Notice } from "@/components/ui";
import {
  claimTokens,
  readBookingTokens,
  type MyAppointment,
  type MyPackage,
  type MyPackageRequest,
} from "@/lib/client-area";
import { formatPrice, whatsappLink } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatLongDate, formatTime } from "@/lib/time";
import { Icon } from "@/components/icons";
import { clientSignOut } from "./actions";
import { SalonCard, type SalonSummary } from "./salon-card";
import { MyPackages } from "./my-packages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Central do cliente", robots: { index: false } };

const STATUS: Record<MyAppointment["status"], { label: string; className: string }> = {
  confirmed: {
    label: "Confirmado",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  completed: { label: "Atendido", className: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300" },
  cancelled: { label: "Desmarcado", className: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400" },
  no_show: { label: "Não compareceu", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export default async function MinhaContaPage({
  searchParams,
}: {
  searchParams: Promise<{ salao?: string; vincular?: string; busca?: string }>;
}) {
  const { salao, vincular, busca } = await searchParams;
  const query = (busca ?? "")
    .replace(/[%_,()]/g, " ")
    .trim()
    .slice(0, 60);
  const slug = salao && /^[a-z0-9-]{3,60}$/.test(salao) ? salao : null;
  const here = slug ? `/minha-conta?salao=${slug}` : "/minha-conta";
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/minha-conta/entrar?next=${encodeURIComponent(here)}`);

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  // horários marcados neste aparelho antes de entrar passam a ser da conta
  // (e o do link aberto, quando veio da página de um agendamento)
  await claimTokens(supabase, [...(await readBookingTokens()), ...(vincular ? [vincular] : [])]);

  const [{ data }, { data: salon }, { data: pkgData }, { data: reqData }] = await Promise.all([
    supabase.rpc("my_appointments_v2").returns<MyAppointment>(),
    slug
      ? supabase
          .from("salons")
          .select("name, slug, logo_url")
          .eq("slug", slug)
          .maybeSingle<{ name: string; slug: string; logo_url: string | null }>()
      : Promise.resolve({ data: null }),
    supabase.rpc("my_packages").returns<MyPackage>(),
    supabase.rpc("my_package_requests").returns<MyPackageRequest>(),
  ]);
  const requests = ((reqData ?? []) as unknown as MyPackageRequest[]).filter((r) => !slug || r.salon_slug === slug);
  const packages = ((pkgData ?? []) as unknown as MyPackage[]).filter((p) => !slug || p.salon_slug === slug);
  const all = (data ?? []) as unknown as MyAppointment[];
  const now = Date.now();
  const upcoming = all
    .filter((a) => a.status === "confirmed" && new Date(a.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = all.filter((a) => !upcoming.includes(a)).slice(0, 30);

  // "Meus salões": onde já agendou ou tem pacote (e o salão aberto agora)
  const { data: favRows } = await supabase
    .from("client_favorite_salons")
    .select("salon:salons(slug)")
    .eq("user_id", user.id)
    .order("created_at")
    .returns<{ salon: { slug: string } | null }[]>();
  const favSlugs = (favRows ?? []).map((f) => f.salon?.slug).filter((x): x is string => !!x);
  const mySlugs = [
    ...new Set([
      ...favSlugs,
      ...(slug ? [slug] : []),
      ...all.map((a) => a.salon_slug),
      ...packages.map((p) => p.salon_slug),
    ]),
  ].slice(0, 10);
  const salonCols = "id, slug, name, logo_url, address, whatsapp";
  const [{ data: mine }, { data: found }] = await Promise.all([
    mySlugs.length
      ? supabase.from("salons").select(salonCols).in("slug", mySlugs).returns<SalonSummary[]>()
      : Promise.resolve({ data: [] as SalonSummary[] }),
    query.length >= 2
      ? supabase
          .from("salons")
          .select(salonCols)
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(8)
          .returns<SalonSummary[]>()
      : Promise.resolve({ data: null }),
  ]);
  const withRating = async (list: SalonSummary[]) =>
    Promise.all(
      list.map(async (x) => {
        const { data: r } = await supabase
          .rpc("salon_rating_summary", { p_salon: x.id })
          .returns<{ professional_id: string | null; average: number; total: number }>();
        const row = ((r ?? []) as unknown as { professional_id: string | null; average: number; total: number }[]).find(
          (y) => y.professional_id === null,
        );
        return { ...x, rating: row ? { average: Number(row.average), total: row.total } : null };
      }),
    );
  const mySalons = await withRating(
    mySlugs.map((sl) => (mine ?? []).find((x) => x.slug === sl)).filter((x): x is SalonSummary => !!x),
  );
  const foundSalons = found ? await withRating(found) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-6 pb-16">
      <section className="relative isolate -mx-5 -mt-6 overflow-hidden px-5 pb-5 pt-6 text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_140%_at_100%_0%,#c026d3_0%,transparent_55%),radial-gradient(80%_120%_at_0%_100%,#f97316_0%,transparent_60%),linear-gradient(135deg,#1e1033,#3b0d3f)]" />
        <div className="flex items-center justify-between gap-3">
          {salon ? (
            <Link href={`/${salon.slug}`} className="text-sm text-white/75 hover:text-white">
              ‹ {salon.name}
            </Link>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">Agenda Salão</span>
          )}
          <form action={clientSignOut}>
            <input type="hidden" name="back" value={slug ? `/${slug}` : "/minha-conta/entrar"} />
            <button className="text-sm text-white/75 underline-offset-4 hover:underline">Sair</button>
          </form>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {meta.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-white/50" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40">
              <Icon name="user" size={26} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold leading-tight">Central do cliente</h1>
            <p className="truncate text-sm text-white/75">{meta.full_name ?? meta.name ?? user.email}</p>
          </div>
          <Link
            href="/minha-conta/perfil"
            className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold ring-1 ring-white/30 hover:bg-white/25"
          >
            Editar perfil
          </Link>
        </div>
        <div className="mt-4">
          <form action="/minha-conta#busca" className="flex gap-2">
            {slug && <input type="hidden" name="salao" value={slug} />}
            <input
              name="busca"
              defaultValue={query}
              placeholder="Buscar barbearia, salão ou estúdio"
              minLength={2}
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/95 px-3.5 py-2.5 text-base text-stone-900 outline-none focus:ring-4 focus:ring-white/30"
            />
            <button
              className="flex items-center rounded-xl bg-white/15 px-3.5 text-white ring-1 ring-white/30 hover:bg-white/25"
              aria-label="Buscar"
            >
              <Icon name="search" size={20} />
            </button>
          </form>
        </div>
      </section>

      {foundSalons && (
        <section className="flex flex-col gap-3" id="busca">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Resultado da busca
          </h2>
          {foundSalons &&
            (foundSalons.length === 0 ? (
              <Notice>Nenhum salão encontrado com &quot;{query}&quot;.</Notice>
            ) : (
              foundSalons
                .filter((x) => !mySalons.some((m) => m.id === x.id))
                .map((x) => (
                  <SalonCard
                    key={x.id}
                    s={x}
                    saved={false}
                    back={`/minha-conta?busca=${encodeURIComponent(query)}#busca`}
                  />
                ))
            ))}
        </section>
      )}

      <section className="flex flex-col gap-3" id="saloes">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          {mySalons.length > 0 ? "Meus salões" : "Encontre seu salão pela busca acima"}
        </h2>
        {mySalons.map((x) => (
          <SalonCard key={x.id} s={x} saved={favSlugs.includes(x.slug)} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          Meus próximos horários
        </h2>
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
      </section>

      {(packages.length > 0 || requests.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Meus pacotes e consumo
          </h2>
          <MyPackages packages={packages} requests={requests} showSalon={!slug} back={here} />
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Anteriores</h2>
          <ul className="flex flex-col divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {past.map((a) => (
              <li key={a.manage_token}>
                <Link
                  href={`/${a.salon_slug}/agendamento/${a.manage_token}${a.status === "completed" && !a.reviewed ? "#avaliar" : ""}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.service_name}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {formatLongDate(a.starts_at, a.salon_timezone)} · {a.professional_name}
                      {(!slug || a.salon_slug !== slug) && ` · ${a.salon_name}`}
                    </span>
                  </span>
                  {a.status === "completed" &&
                  !a.reviewed &&
                  new Date(a.starts_at).getTime() > Date.now() - 60 * 86_400_000 ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      ★ Avaliar
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[a.status].className}`}
                    >
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
        {showSalon && (
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500">{a.salon_name}</span>
        )}
        <span className="font-display text-xl font-semibold">{a.service_name}</span>
        <span className="font-medium first-letter:uppercase">{when}</span>
        <span className="text-sm text-stone-500">
          Com {a.professional_name} · {formatPrice(a.price_cents)}
        </span>
      </Link>
      <div className="flex flex-wrap gap-2">
        {canChange ? (
          <>
            <Link
              href={`/${a.salon_slug}/agendar?remarcar=${a.manage_token}`}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium dark:border-stone-700"
            >
              Remarcar
            </Link>
            <Link
              href={`${detail}?desmarcar=1`}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-red-600 dark:border-stone-700"
            >
              Desmarcar
            </Link>
          </>
        ) : (
          a.salon_whatsapp && (
            <a
              href={whatsappLink(
                a.salon_whatsapp,
                `Olá! Sobre meu horário de ${a.service_name} com ${a.professional_name} em ${when}.`,
              )}
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

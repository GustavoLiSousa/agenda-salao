import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar, Card } from "@/components/ui";
import type { MyAppointment, MyPackage, MyPackageRequest } from "@/lib/client-area";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/format";
import { fullPrice, itemsLabel, validityLabel, type SalonPackage } from "@/lib/packages";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatLongDate, formatTime } from "@/lib/time";
import type { Professional, Salon, Service } from "@/lib/types";
import { MyPackages } from "../../my-packages";
import { PackageRequestButton } from "../../package-request";
import { FavoriteButton } from "../../salon-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu salão", robots: { index: false } };

type Review = {
  id: string;
  salon_rating: number;
  comment: string | null;
  reply: string | null;
  created_at: string;
  client_first_name: string | null;
  professional_name: string;
};
type Score = { professional_id: string | null; average: number; total: number };

const h2 = "text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300";
const pill =
  "inline-flex items-center justify-center rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-400 dark:border-stone-700 dark:text-stone-200";

export default async function ClientSalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) redirect("/");
  const here = `/minha-conta/salao/${slug}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?aba=cliente&next=${encodeURIComponent(here)}`);

  const { data: salon } = await supabase.from("salons").select("*").eq("slug", slug).maybeSingle<Salon>();
  if (!salon) notFound();

  const [
    { data: fav },
    { data: apptData },
    { data: pkgMine },
    { data: reqData },
    { data: services },
    { data: pros },
    { data: pkgData },
    { data: reviewData },
    { data: scoreData },
    { data: meRows },
  ] = await Promise.all([
    supabase
      .from("client_favorite_salons")
      .select("salon_id")
      .eq("user_id", user.id)
      .eq("salon_id", salon.id)
      .maybeSingle(),
    supabase.rpc("my_appointments_v2").returns<MyAppointment>(),
    supabase.rpc("my_packages").returns<MyPackage>(),
    supabase.rpc("my_package_requests").returns<MyPackageRequest>(),
    supabase
      .from("services")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .order("name")
      .returns<Service[]>(),
    supabase
      .from("professionals")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .order("name")
      .returns<Professional[]>(),
    supabase
      .from("packages")
      .select("*, items:package_items(service_id, quantity, service:services(name, price_cents, active))")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .returns<SalonPackage[]>(),
    supabase.rpc("salon_reviews", { p_salon: salon.id, p_limit: 5 }).returns<Review>(),
    supabase.rpc("salon_rating_summary", { p_salon: salon.id }).returns<Score>(),
    supabase
      .from("clients")
      .select("name, phone")
      .eq("user_id", user.id)
      .eq("salon_id", salon.id)
      .limit(1)
      .returns<{ name: string | null; phone: string }[]>(),
  ]);

  const appts = ((apptData ?? []) as unknown as MyAppointment[]).filter((a) => a.salon_slug === slug);
  const now = Date.now();
  const upcoming = appts
    .filter((a) => a.status === "confirmed" && new Date(a.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = appts.filter((a) => !upcoming.includes(a)).slice(0, 10);
  const myPackages = ((pkgMine ?? []) as unknown as MyPackage[]).filter((p) => p.salon_slug === slug);
  const requests = ((reqData ?? []) as unknown as MyPackageRequest[]).filter((r) => r.salon_slug === slug);
  const pendingIds = new Set(requests.filter((r) => r.status === "pending").map((r) => r.package_id));
  const packages = (pkgData ?? []).filter((p) => p.items.length > 0 && p.items.every((i) => i.service?.active));
  const reviews = (reviewData ?? []) as unknown as Review[];
  const scores = (scoreData ?? []) as unknown as Score[];
  const salonScore = scores.find((s) => s.professional_id === null && s.total > 0);
  const proScore = new Map(scores.filter((s) => s.professional_id).map((s) => [s.professional_id!, s]));
  const me = meRows?.[0];
  const myName = me?.name ?? (user.user_metadata?.name as string | undefined) ?? "";
  const myPhone = me?.phone.replace(/^55/, "") ?? "";
  const tz = salon.timezone;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-6 pb-16">
      <Link href="/minha-conta" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
        ‹ Meus horários
      </Link>

      <div className="flex items-start gap-3">
        {salon.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={salon.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-display text-2xl font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {salon.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">{salon.name}</h1>
          {salonScore && (
            <p className="text-sm text-stone-500">
              <span className="text-amber-500">★</span> {Number(salonScore.average).toFixed(1).replace(".", ",")} ·{" "}
              {salonScore.total} {salonScore.total === 1 ? "avaliação" : "avaliações"}
            </p>
          )}
          {salon.address && <p className="text-sm text-stone-500">{salon.address}</p>}
        </div>
        <FavoriteButton salonId={salon.id} saved={!!fav} back={here} />
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href={`/${slug}/agendar`}
          className="rounded-2xl bg-stone-900 p-4 text-center font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
        >
          Agendar horário
        </Link>
        <div className="grid grid-cols-3 gap-2">
          {salon.address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.address)}`}
              target="_blank"
              rel="noreferrer"
              className={pill}
            >
              Como chegar
            </a>
          ) : (
            <span className={`${pill} opacity-40`}>Sem endereço</span>
          )}
          {salon.whatsapp ? (
            <a
              href={whatsappLink(salon.whatsapp, `Olá, ${salon.name}!`)}
              target="_blank"
              rel="noreferrer"
              className={pill}
            >
              WhatsApp
            </a>
          ) : (
            <span className={`${pill} opacity-40`}>Sem WhatsApp</span>
          )}
          <Link href={`/${slug}`} className={pill}>
            Página do salão
          </Link>
        </div>
      </div>

      {/* Meus horários aqui */}
      <section className="flex flex-col gap-3">
        <h2 className={h2}>Meus horários aqui</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum horário marcado neste salão.</p>
        ) : (
          upcoming.map((a) => (
            <Link key={a.manage_token} href={`/${slug}/agendamento/${a.manage_token}`}>
              <Card className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{a.service_name}</span>
                  <span className="block text-sm text-stone-500">
                    {formatLongDate(a.starts_at, tz)} às {formatTime(a.starts_at, tz)} · {a.professional_name}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-brand-700 dark:text-brand-300">Remarcar ›</span>
              </Card>
            </Link>
          ))
        )}
        {past.length > 0 && (
          <details className="rounded-2xl border border-stone-200/80 bg-white text-sm dark:border-stone-800 dark:bg-stone-900">
            <summary className="cursor-pointer px-4 py-3 font-medium">Anteriores ({past.length})</summary>
            <ul className="divide-y divide-stone-100 border-t border-stone-100 dark:divide-stone-800 dark:border-stone-800">
              {past.map((a) => (
                <li key={a.manage_token}>
                  <Link
                    href={`/${slug}/agendamento/${a.manage_token}${a.status === "completed" && !a.reviewed ? "#avaliar" : ""}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 truncate">
                      {a.service_name} · {formatLongDate(a.starts_at, tz)}
                    </span>
                    {a.status === "completed" && !a.reviewed ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        ★ Avaliar
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-stone-500">
                        {a.status === "completed"
                          ? "Atendido"
                          : a.status === "cancelled"
                            ? "Desmarcado"
                            : a.status === "no_show"
                              ? "Faltou"
                              : ""}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Meus pacotes aqui */}
      {(myPackages.length > 0 || requests.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Meus pacotes</h2>
          <MyPackages packages={myPackages} requests={requests} showSalon={false} back={here} />
        </section>
      )}

      {/* Pacotes do salão */}
      {packages.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Pacotes do salão</h2>
          {packages.map((p) => {
            const full = fullPrice(p.items);
            const save = full - p.price_cents;
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-stone-600 dark:text-stone-400">{itemsLabel(p.items)}</p>
                    {p.description && <p className="text-xs text-stone-500">{p.description}</p>}
                    <p className="text-xs text-stone-500">{validityLabel(p.validity_days)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {save > 0 && <p className="text-xs text-stone-400 line-through">{formatPrice(full)}</p>}
                    <p className="font-display text-xl font-semibold">{formatPrice(p.price_cents)}</p>
                  </div>
                </div>
                {pendingIds.has(p.id) ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Pedido enviado. Aguardando o salão confirmar.
                  </p>
                ) : (
                  <PackageRequestButton packageId={p.id} name={myName} phone={myPhone} />
                )}
              </Card>
            );
          })}
        </section>
      )}

      {/* Equipe */}
      {(pros ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Equipe</h2>
          <ul className="flex flex-col gap-2">
            {(pros ?? []).map((p) => {
              const sc = proScore.get(p.id);
              return (
                <li key={p.id}>
                  <Card className="flex items-center gap-3">
                    <Avatar name={p.name} src={p.photo_url} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      {sc && sc.total > 0 && (
                        <p className="text-xs text-stone-500">
                          <span className="text-amber-500">★</span> {Number(sc.average).toFixed(1).replace(".", ",")} (
                          {sc.total})
                        </p>
                      )}
                      {p.bio && <p className="truncate text-xs text-stone-500">{p.bio}</p>}
                    </div>
                    <Link href={`/${slug}/agendar?profissional=${p.id}`} className={pill}>
                      Ver agenda
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Serviços */}
      {(services ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Serviços</h2>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {(services ?? []).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${slug}/agendar?servico=${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-stone-500">{formatDuration(s.duration_min)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{formatPrice(s.price_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Avaliações */}
      {reviews.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Avaliações</h2>
          {reviews.map((r) => (
            <Card key={r.id} className="flex flex-col gap-1.5 text-sm">
              <p>
                <span className="text-amber-500">{"★".repeat(r.salon_rating)}</span>
                <span className="text-stone-300 dark:text-stone-700">{"★".repeat(5 - r.salon_rating)}</span>
                <span className="ml-2 text-xs text-stone-500">
                  {r.client_first_name ?? "Cliente"} · com {r.professional_name}
                </span>
              </p>
              {r.comment && <p className="text-stone-700 dark:text-stone-300">{r.comment}</p>}
              {r.reply && (
                <p className="border-l-2 border-brand-300 pl-3 text-xs text-stone-500">Resposta do salão: {r.reply}</p>
              )}
            </Card>
          ))}
          <Link
            href={`/${slug}#avaliacoes`}
            className="text-sm text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
          >
            Ver todas ›
          </Link>
        </section>
      )}
    </main>
  );
}

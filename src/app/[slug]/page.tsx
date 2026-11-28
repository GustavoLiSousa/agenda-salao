import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/format";
import type { Professional, Salon, Service } from "@/lib/types";
import { InstallApp } from "@/components/install-app";
import { SectionNav } from "@/components/section-nav";
import { Stars, formatRating } from "@/components/stars";
import { fullPrice, itemsLabel, validityLabel, type SalonPackage } from "@/lib/packages";
import { openStatus, openingHours, WEEKDAYS, type WorkingHourRow } from "@/lib/opening-hours";
import type { MyAppointment } from "@/lib/client-area";
import { formatLongDate, formatTime } from "@/lib/time";
import { FavoriteButton } from "@/app/minha-conta/salon-card";
import { ShortcutTile } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("salons").select("name, address").eq("slug", slug).maybeSingle();
  return data ? { title: `${data.name} · Agende online`, description: data.address ?? undefined } : {};
}

export default async function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>O banco de dados ainda não foi configurado. Veja o README.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: salon } = await supabase.from("salons").select("*").eq("slug", slug).maybeSingle<Salon>();
  if (!salon) notFound();

  const [{ data: services }, { data: professionals }] = await Promise.all([
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
  ]);

  const { data: pkgData } = await supabase
    .from("packages")
    .select("*, items:package_items(service_id, quantity, service:services(name, price_cents, active))")
    .eq("salon_id", salon.id)
    .eq("active", true)
    .order("sort_order")
    .order("created_at")
    .returns<SalonPackage[]>();
  // só mostra pacotes cujos serviços continuam ativos
  const packages = (pkgData ?? []).filter((p) => p.items.length > 0 && p.items.every((i) => i.service?.active));

  const proIds = (professionals ?? []).map((p) => p.id);
  const { data: workRows } = proIds.length
    ? await supabase
        .from("working_hours")
        .select("weekday, start_time, end_time")
        .in("professional_id", proIds)
        .returns<WorkingHourRow[]>()
    : { data: [] as WorkingHourRow[] };
  type ReviewRow = {
    id: string;
    salon_rating: number;
    professional_rating: number;
    comment: string | null;
    reply: string | null;
    created_at: string;
    client_first_name: string | null;
    professional_name: string;
  };
  const [{ data: reviewsData }, { data: summaryData }] = await Promise.all([
    supabase.rpc("salon_reviews", { p_salon: salon.id, p_limit: 20 }).returns<ReviewRow>(),
    supabase
      .rpc("salon_rating_summary", { p_salon: salon.id })
      .returns<{ professional_id: string | null; average: number; total: number }>(),
  ]);
  const reviews = (reviewsData ?? []) as unknown as ReviewRow[];
  const summary = (summaryData ?? []) as unknown as {
    professional_id: string | null;
    average: number;
    total: number;
  }[];
  const salonScore = summary.find((r) => r.professional_id === null && r.total > 0);
  const proScore = new Map(summary.filter((r) => r.professional_id).map((r) => [r.professional_id!, r]));

  // Cliente logado: salvar como "Meu salão", ver os próprios horários e avaliar
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: fav }, { data: apptData }] = user
    ? await Promise.all([
        supabase
          .from("client_favorite_salons")
          .select("salon_id")
          .eq("user_id", user.id)
          .eq("salon_id", salon.id)
          .maybeSingle(),
        supabase.rpc("my_appointments_v2").returns<MyAppointment>(),
      ])
    : [{ data: null }, { data: null }];
  const myAppts = ((apptData ?? []) as unknown as MyAppointment[]).filter((a) => a.salon_slug === slug);
  const nowMs = Date.now();
  const myUpcoming = myAppts
    .filter((a) => a.status === "confirmed" && new Date(a.ends_at).getTime() > nowMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 3);
  const toReview = myAppts.find((a) => a.status === "completed" && !a.reviewed);
  const reviewHref = toReview ? `/${slug}/agendamento/${toReview.manage_token}#avaliar` : null;

  const hours = openingHours(workRows ?? []);
  const hasHours = hours.some((d) => d.length > 0);
  const status = hasHours ? openStatus(hours, salon.timezone) : null;
  const mapQuery = salon.address ? encodeURIComponent(`${salon.address}`) : null;

  const sections = [
    { id: "servicos", label: "Serviços" },
    ...(packages.length > 0 ? [{ id: "pacotes", label: "Pacotes" }] : []),
    ...((professionals ?? []).length > 0 ? [{ id: "equipe", label: "Equipe" }] : []),
    { id: "avaliacoes", label: "Avaliações" },
    ...(salon.address || hasHours || salon.whatsapp ? [{ id: "local", label: "Local e horário" }] : []),
  ];

  // agrupa por categoria
  const groups = new Map<string, Service[]>();
  for (const s of services ?? []) {
    const k = s.category?.trim() || "Serviços";
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const instagram = salon.instagram?.replace(/^@/, "");

  return (
    <main className="min-h-screen bg-[#f7f5f2] pb-28 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Capa */}
      <header className="relative">
        <div className="relative h-56 w-full overflow-hidden bg-stone-900 sm:h-72">
          {salon.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top_right,#4d3922_0%,#1c1917_60%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />
          <Link
            href={`/minha-conta?salao=${salon.slug}`}
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-stone-900 shadow-md backdrop-blur transition hover:bg-white"
          >
            Central do cliente
          </Link>
        </div>
        <div className="relative mx-auto -mt-16 flex max-w-2xl items-end gap-4 px-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-[#f7f5f2] bg-stone-900 shadow-lg dark:border-stone-950">
            {salon.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salon.logo_url} alt={salon.name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-4xl font-semibold text-brand-300">{salon.name[0]}</span>
            )}
          </div>
          <div className="ml-auto pb-1">
            {user ? (
              <FavoriteButton salonId={salon.id} saved={!!fav} back={`/${salon.slug}`} />
            ) : (
              <Link
                href={`/entrar?aba=cliente&next=${encodeURIComponent(`/${salon.slug}`)}`}
                className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
              >
                <span className="text-lg leading-none">♡</span>
                Salvar
              </Link>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-5 pt-3">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{salon.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
            {salon.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(salon.address)}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                {salon.address}
              </a>
            )}
            {salonScore && (
              <a
                href="#avaliacoes"
                className="flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300"
              >
                <Stars value={Number(salonScore.average)} /> {formatRating(Number(salonScore.average))} (
                {salonScore.total})
              </a>
            )}
            {status && (
              <a href="#local" className={status.open ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}>
                {status.label}
              </a>
            )}
            {instagram && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                @{instagram}
              </a>
            )}
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {mapQuery && (
              <ShortcutTile
                href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                icon="route"
                label="Como chegar"
                external
              />
            )}
            {salon.whatsapp && (
              <ShortcutTile
                href={whatsappLink(salon.whatsapp, `Olá, ${salon.name}!`)}
                icon="whatsapp"
                label="WhatsApp"
                external
              />
            )}
            {(hasHours || !!salon.address) && <ShortcutTile href="#local" icon="clock" label="Horários" />}
            <ShortcutTile
              href={reviewHref ?? "#avaliacoes"}
              icon="star"
              label={reviewHref ? "Avaliar" : "Avaliações"}
            />
          </div>
        </div>
      </header>

      <SectionNav items={sections} />

      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 pt-8">
        <InstallApp salonName={salon.name} />

        {user && (myUpcoming.length > 0 || reviewHref) && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              Meus horários aqui
              <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            </h2>
            {myUpcoming.map((a) => (
              <Link
                key={a.manage_token}
                href={`/${salon.slug}/agendamento/${a.manage_token}`}
                className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 transition hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40"
              >
                <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-white py-1.5 dark:bg-stone-900">
                  <span className="font-display text-lg font-semibold leading-none">
                    {formatTime(a.starts_at, salon.timezone)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.service_name}</p>
                  <p className="truncate text-xs text-stone-500">
                    {formatLongDate(a.starts_at, salon.timezone)} · com {a.professional_name}
                  </p>
                </div>
                <span className="text-sm text-stone-400">›</span>
              </Link>
            ))}
            {reviewHref && (
              <Link
                href={reviewHref}
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
              >
                <span className="text-2xl text-amber-500">★</span>
                <span className="flex-1">
                  <b>Como foi seu {toReview!.service_name}?</b>
                  <span className="block text-xs text-stone-500">Toque para avaliar o seu atendimento.</span>
                </span>
                <span className="text-sm text-stone-400">›</span>
              </Link>
            )}
            <Link href={`/minha-conta?salao=${salon.slug}`} className="text-sm text-brand-700 dark:text-brand-300">
              Ver todos os meus horários ›
            </Link>
          </section>
        )}

        {/* Serviços */}
        <div id="servicos" className="flex scroll-mt-16 flex-col gap-10">
          {groups.size === 0 && (
            <p className="text-sm text-stone-500">Os serviços aparecem aqui assim que o salão cadastrar.</p>
          )}
          {[...groups.entries()].map(([cat, items]) => (
            <section key={cat}>
              <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                {cat}
                <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
              </h2>
              <ul className="flex flex-col gap-3">
                {items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/${salon.slug}/agendar?servico=${s.id}`}
                      className="group flex items-stretch gap-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-3 transition hover:border-stone-400 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
                    >
                      {s.image_url && (
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:h-28 sm:w-28">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.image_url}
                            alt={s.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                        <div>
                          <p className="font-display text-lg font-semibold leading-snug">{s.name}</p>
                          {s.description && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{s.description}</p>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-sm text-stone-500">{formatDuration(s.duration_min)}</span>
                          <span className="flex items-center gap-3">
                            <span className="font-semibold">{formatPrice(s.price_cents)}</span>
                            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white transition group-hover:bg-brand-700 dark:bg-stone-100 dark:text-stone-900">
                              Agendar
                            </span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Pacotes */}
        {packages.length > 0 && (
          <section id="pacotes" className="scroll-mt-16">
            <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              Pacotes
              <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            </h2>
            <ul className="flex flex-col gap-3">
              {packages.map((p) => {
                const full = fullPrice(p.items);
                const save = full - p.price_cents;
                const pct = full > 0 ? Math.round((save / full) * 100) : 0;
                return (
                  <li
                    key={p.id}
                    className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-white to-brand-50 p-4 dark:border-brand-900 dark:from-stone-900 dark:to-stone-900"
                  >
                    {pct >= 5 && (
                      <span className="absolute right-3 top-3 rounded-full bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white">
                        -{pct}%
                      </span>
                    )}
                    <p className="pr-16 font-display text-lg font-semibold leading-snug">{p.name}</p>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{itemsLabel(p.items)}</p>
                    {p.description && <p className="mt-1 text-sm text-stone-500">{p.description}</p>}
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        {save > 0 && <p className="text-xs text-stone-400 line-through">{formatPrice(full)}</p>}
                        <p className="font-display text-2xl font-semibold">{formatPrice(p.price_cents)}</p>
                        <p className="text-xs text-stone-500">{validityLabel(p.validity_days)}</p>
                      </div>
                      <a
                        href={whatsappLink(
                          salon.whatsapp,
                          `Olá, ${salon.name}! Tenho interesse no pacote "${p.name}" (${formatPrice(p.price_cents)}).`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-[#1f9d55] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#188247]"
                      >
                        Quero este pacote
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-stone-500">
              O pagamento é combinado direto com o salão. Depois é só agendar normalmente.
            </p>
          </section>
        )}

        {/* Equipe */}
        {(professionals ?? []).length > 0 && (
          <section id="equipe" className="scroll-mt-16">
            <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              Equipe
              <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            </h2>
            <ul className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
              {(professionals ?? []).map((p) => (
                <li key={p.id} className="w-28 shrink-0 text-center">
                  <Link href={`/${salon.slug}/agendar?profissional=${p.id}`} className="group block">
                    <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-800">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-3xl text-stone-400">
                          {p.name[0]}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium">{p.name}</p>
                    {proScore.get(p.id) && (
                      <p className="text-xs text-amber-600">
                        ★ {formatRating(Number(proScore.get(p.id)!.average))} ({proScore.get(p.id)!.total})
                      </p>
                    )}
                    {p.bio && <p className="line-clamp-2 text-xs text-stone-500">{p.bio}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Avaliações */}
        <section id="avaliacoes" className="scroll-mt-16">
          <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Avaliações
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          </h2>
          {salonScore && (
            <div className="mb-4 flex items-center gap-3">
              <span className="font-display text-4xl font-semibold">{formatRating(Number(salonScore.average))}</span>
              <span className="flex flex-col">
                <Stars value={Number(salonScore.average)} size={18} />
                <span className="text-sm text-stone-500">
                  {salonScore.total} avaliaç{salonScore.total === 1 ? "ão" : "ões"} de clientes atendidos
                </span>
              </span>
            </div>
          )}
          {reviews.length === 0 && (
            <p className="mb-3 text-sm text-stone-500">Ainda sem avaliações. Quem for atendido aqui pode avaliar.</p>
          )}
          {reviewHref ? (
            <Link
              href={reviewHref}
              className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              ★ Avaliar meu atendimento
            </Link>
          ) : (
            !user && (
              <Link
                href={`/entrar?aba=cliente&next=${encodeURIComponent(`/${salon.slug}#avaliacoes`)}`}
                className="mb-4 block text-sm text-brand-700 dark:text-brand-300"
              >
                Já foi atendido aqui? Entre para avaliar ›
              </Link>
            )
          )}
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-stone-200/80 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{r.client_first_name ?? "Cliente"}</span>
                  <span className="text-xs text-stone-500">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: salon.timezone,
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(r.created_at))}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  <Stars value={r.salon_rating} /> com {r.professional_name}
                </p>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                {r.reply && (
                  <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    <b>Resposta do salão:</b> {r.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Local e horário */}
        {sections.some((x) => x.id === "local") && (
          <section id="local" className="scroll-mt-16">
            <h2 className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              Local e horário
              <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            </h2>
            <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900">
              {mapQuery && (
                <iframe
                  title={`Mapa: ${salon.name}`}
                  src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                  className="h-56 w-full border-0 sm:h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
              <div className="flex flex-col gap-4 p-4">
                {salon.address && <p className="font-medium">{salon.address}</p>}
                <div className="flex flex-wrap gap-2">
                  {mapQuery && (
                    <>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
                      >
                        Abrir no Google Maps
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium dark:border-stone-700"
                      >
                        Como chegar
                      </a>
                    </>
                  )}
                  {salon.whatsapp && (
                    <a
                      href={whatsappLink(salon.whatsapp, `Olá, ${salon.name}! Tenho uma dúvida.`)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#188247]"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
                {hasHours && (
                  <div>
                    {status && (
                      <p
                        className={`mb-2 text-sm font-semibold ${status.open ? "text-emerald-700 dark:text-emerald-400" : "text-stone-500"}`}
                      >
                        {status.label}
                      </p>
                    )}
                    <ul className="flex flex-col divide-y divide-stone-100 text-sm dark:divide-stone-800">
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <li
                          key={d}
                          className={`flex justify-between gap-4 py-1.5 ${status?.today === d ? "font-semibold" : ""}`}
                        >
                          <span>{WEEKDAYS[d]}</span>
                          <span className={hours[d].length ? "" : "text-stone-400"}>
                            {hours[d].length ? hours[d].map((i) => `${i.start} às ${i.end}`).join(" · ") : "Fechado"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Botão fixo */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200/80 bg-[#f7f5f2]/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <Link
          href={`/${salon.slug}/agendar`}
          className="mx-auto flex max-w-2xl items-center justify-center rounded-2xl bg-stone-900 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-stone-800 active:scale-[0.99] dark:bg-stone-100 dark:text-stone-900"
        >
          Agendar horário
        </Link>
      </div>
    </main>
  );
}

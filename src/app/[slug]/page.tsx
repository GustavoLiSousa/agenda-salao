import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/format";
import type { Professional, Salon, Service } from "@/lib/types";
import { InstallApp } from "@/components/install-app";
import { SectionNav } from "@/components/section-nav";
import { openStatus, openingHours, WEEKDAYS, type WorkingHourRow } from "@/lib/opening-hours";

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
    supabase.from("services").select("*").eq("salon_id", salon.id).eq("active", true).order("sort_order").order("name").returns<Service[]>(),
    supabase.from("professionals").select("*").eq("salon_id", salon.id).eq("active", true).order("sort_order").order("name").returns<Professional[]>(),
  ]);

  const proIds = (professionals ?? []).map((p) => p.id);
  const { data: workRows } = proIds.length
    ? await supabase.from("working_hours").select("weekday, start_time, end_time").in("professional_id", proIds).returns<WorkingHourRow[]>()
    : { data: [] as WorkingHourRow[] };
  const hours = openingHours(workRows ?? []);
  const hasHours = hours.some((d) => d.length > 0);
  const status = hasHours ? openStatus(hours, salon.timezone) : null;
  const mapQuery = salon.address ? encodeURIComponent(`${salon.address}`) : null;

  const sections = [
    { id: "servicos", label: "Serviços" },
    ...((professionals ?? []).length > 0 ? [{ id: "equipe", label: "Equipe" }] : []),
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
            Meus agendamentos
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
        </div>
        <div className="mx-auto max-w-2xl px-5 pt-3">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{salon.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
            {salon.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(salon.address)}`} target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-stone-100">
                {salon.address}
              </a>
            )}
            {status && (
              <a href="#local" className={status.open ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}>
                {status.label}
              </a>
            )}
            {instagram && (
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-stone-100">
                @{instagram}
              </a>
            )}
          </div>
        </div>
      </header>

      <SectionNav items={sections} />

      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 pt-8">
        <InstallApp salonName={salon.name} />

        {/* Serviços */}
        <div id="servicos" className="flex scroll-mt-16 flex-col gap-10">
        {groups.size === 0 && <p className="text-sm text-stone-500">Os serviços aparecem aqui assim que o salão cadastrar.</p>}
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
                        <img src={s.image_url} alt={s.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                      <div>
                        <p className="font-display text-lg font-semibold leading-snug">{s.name}</p>
                        {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{s.description}</p>}
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
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-3xl text-stone-400">{p.name[0]}</span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium">{p.name}</p>
                    {p.bio && <p className="line-clamp-2 text-xs text-stone-500">{p.bio}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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
                      <p className={`mb-2 text-sm font-semibold ${status.open ? "text-emerald-700 dark:text-emerald-400" : "text-stone-500"}`}>
                        {status.label}
                      </p>
                    )}
                    <ul className="flex flex-col divide-y divide-stone-100 text-sm dark:divide-stone-800">
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <li key={d} className={`flex justify-between gap-4 py-1.5 ${status?.today === d ? "font-semibold" : ""}`}>
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

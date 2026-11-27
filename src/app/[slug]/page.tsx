import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/format";
import type { Professional, Salon, Service } from "@/lib/types";

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
            {instagram && (
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-stone-100">
                @{instagram}
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 pt-8">
        {/* Serviços */}
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

        {/* Equipe */}
        {(professionals ?? []).length > 0 && (
          <section>
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
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {salon.whatsapp && (
          <a
            href={whatsappLink(salon.whatsapp, `Olá, ${salon.name}! Tenho uma dúvida.`)}
            className="text-center text-sm text-stone-500 underline-offset-4 hover:underline"
          >
            Dúvidas? Fale com o salão no WhatsApp
          </a>
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

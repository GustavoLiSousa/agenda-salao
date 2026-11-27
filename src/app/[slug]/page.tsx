import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/format";
import type { Professional, Salon, Service } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>O banco de dados ainda não foi configurado. Veja o README.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Salon>();

  if (!salon) notFound();

  const [{ data: services }, { data: professionals }] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .returns<Service[]>(),
    supabase
      .from("professionals")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order")
      .returns<Professional[]>(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">{salon.name}</h1>
        {salon.address && (
          <p className="text-sm text-neutral-500">{salon.address}</p>
        )}
      </header>

      <Link
        href={`/${salon.slug}/agendar`}
        className="rounded-xl bg-violet-600 p-4 text-center text-lg font-semibold text-white"
      >
        Agendar horário
      </Link>

      <section>
        <h2 className="mb-2 font-semibold">Serviços</h2>
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {(services ?? []).map((s) => (
            <li key={s.id}>
              <Link
                href={`/${salon.slug}/agendar?servico=${s.id}`}
                className="flex items-center justify-between gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-neutral-500">
                    {formatDuration(s.duration_min)}
                    {s.description ? ` · ${s.description}` : ""}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block font-semibold">{formatPrice(s.price_cents)}</span>
                  <span className="text-xs text-violet-600">Agendar ›</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Profissionais</h2>
        <ul className="flex flex-wrap gap-2">
          {(professionals ?? []).map((p) => (
            <li
              key={p.id}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
            >
              {p.name}
            </li>
          ))}
        </ul>
      </section>

      {salon.whatsapp && (
        <a
          href={whatsappLink(salon.whatsapp, `Olá, ${salon.name}! Quero agendar um horário.`)}
          className="rounded-xl border border-green-600 p-3 text-center font-semibold text-green-700 dark:text-green-400"
        >
          Falar no WhatsApp
        </a>
      )}

    </main>
  );
}

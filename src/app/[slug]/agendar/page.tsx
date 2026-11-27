import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Professional, Salon, Service } from "@/lib/types";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

type Reschedule = { status: string; service_id: string; professional_id: string };

export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servico?: string; profissional?: string; remarcar?: string }>;
}) {
  const { slug } = await params;
  const { servico, profissional, remarcar } = await searchParams;
  if (!isSupabaseConfigured()) notFound();

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
  const proIds = (professionals ?? []).map((p) => p.id);
  const { data: links } = proIds.length
    ? await supabase
        .from("professional_services")
        .select("professional_id, service_id, price_cents, duration_min")
        .in("professional_id", proIds)
    : { data: [] };

  // cliente com a conta aberta: nome e telefone já preenchidos
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let me: { name: string | null; phone: string } | null = null;
  if (user) {
    const { data: rows } = await supabase
      .from("clients")
      .select("name, phone, salon_id")
      .eq("user_id", user.id)
      .limit(20)
      .returns<{ name: string | null; phone: string; salon_id: string }[]>();
    const row = (rows ?? []).find((r) => r.salon_id === salon.id) ?? rows?.[0];
    if (row) me = { name: row.name, phone: row.phone.replace(/^55/, "") };
    else if (user.user_metadata?.name) me = { name: String(user.user_metadata.name), phone: "" };
  }

  let reschedule: Reschedule | null = null;
  if (remarcar) {
    const { data } = await supabase.rpc("appointment_by_token", { p_token: remarcar }).maybeSingle<Reschedule>();
    if (data?.status === "confirmed") reschedule = data;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/${salon.slug}`}
            className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
          >
            ‹ {salon.name}
          </Link>
          {user && (
            <Link
              href="/minha-conta"
              className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Meus horários
            </Link>
          )}
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          {reschedule ? "Remarcar horário" : "Agendar horário"}
        </h1>
      </div>
      <BookingFlow
        salon={{ id: salon.id, slug: salon.slug, name: salon.name, timezone: salon.timezone }}
        services={services ?? []}
        professionals={professionals ?? []}
        links={links ?? []}
        initialService={reschedule?.service_id ?? servico ?? null}
        initialProfessional={reschedule?.professional_id ?? profissional ?? null}
        rescheduleToken={reschedule ? remarcar! : null}
        initialName={me?.name ?? ""}
        initialPhone={me?.phone ?? ""}
      />
    </main>
  );
}

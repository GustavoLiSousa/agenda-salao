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

  let reschedule: Reschedule | null = null;
  if (remarcar) {
    const { data } = await supabase.rpc("appointment_by_token", { p_token: remarcar }).maybeSingle<Reschedule>();
    if (data?.status === "confirmed") reschedule = data;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href={`/${salon.slug}`} className="text-sm text-violet-600">
        ‹ {salon.name}
      </Link>
      <h1 className="text-2xl font-bold">{reschedule ? "Remarcar horário" : "Agendar horário"}</h1>
      <BookingFlow
        salon={{ id: salon.id, slug: salon.slug, name: salon.name, timezone: salon.timezone }}
        services={services ?? []}
        professionals={professionals ?? []}
        links={links ?? []}
        initialService={reschedule?.service_id ?? servico ?? null}
        initialProfessional={reschedule?.professional_id ?? profissional ?? null}
        rescheduleToken={reschedule ? remarcar! : null}
      />
    </main>
  );
}

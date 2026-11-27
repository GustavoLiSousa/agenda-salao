import Link from "next/link";
import { Card } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireSalon } from "@/lib/session";
import { isValidDay, todayIn } from "@/lib/time";
import { StaffBookingForm } from "./form";

export const metadata = { title: "Agendar | Agenda Salão" };

export default async function NovoAgendamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; prof?: string; hora?: string; nome?: string; tel?: string }>;
}) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;

  let prosQuery = supabase.from("professionals").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name");
  if (!can(membership, "agenda_equipe")) prosQuery = prosQuery.eq("id", membership.professional_id ?? "00000000-0000-0000-0000-000000000000");

  const [{ data: pros }, { data: services }, { data: clients }] = await Promise.all([
    prosQuery,
    supabase.from("services").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
    supabase
      .from("clients")
      .select("id, name, phone")
      .eq("salon_id", salon.id)
      .order("name")
      .limit(5000)
      .returns<{ id: string; name: string | null; phone: string }[]>(),
  ]);
  const ids = (pros ?? []).map((p) => p.id);
  const { data: links } = ids.length
    ? await supabase.from("professional_services").select("professional_id, service_id").in("professional_id", ids)
    : { data: [] };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/painel/agenda" className="text-sm text-brand-700 dark:text-brand-300">‹ Agenda</Link>
      <h1 className="font-display text-3xl font-semibold">Agendar pelo balcão</h1>
      <p className="text-sm text-stone-500">
        Para quem ligou ou chamou no WhatsApp. Aqui você pode encaixar fora do horário normal.
      </p>
      <Card>
        <StaffBookingForm
          tz={salon.timezone}
          day={isValidDay(q.data) ? q.data : todayIn(salon.timezone)}
          professionals={pros ?? []}
          services={services ?? []}
          links={links ?? []}
          initialProfessional={q.prof ?? ""}
          initialName={q.nome ?? ""}
          initialPhone={q.tel ?? ""}
          clients={clients ?? []}
          initialTime={/^\d{2}:\d{2}$/.test(q.hora ?? "") ? q.hora : ""}
        />
      </Card>
    </main>
  );
}

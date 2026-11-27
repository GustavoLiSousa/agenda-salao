"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIntOrNull, parsePriceToCents } from "@/lib/parse";
import { requireSalon } from "@/lib/session";

function fail(message: string): never {
  redirect(`/painel/servicos?erro=${encodeURIComponent(message)}`);
}

export async function saveService(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price_cents = parsePriceToCents(formData.get("price"));
  const duration_min = parseIntOrNull(formData.get("duration"));
  const return_every_days = parseIntOrNull(formData.get("return_every_days"));

  if (name.length < 2) fail("Informe o nome do serviço.");
  if (Number.isNaN(price_cents)) fail("Preço inválido. Exemplo: 45,00");
  if (!duration_min || duration_min < 5 || duration_min > 600)
    fail("Duração inválida. Use minutos, entre 5 e 600.");
  if (return_every_days !== null && return_every_days < 1)
    fail("O retorno precisa ser um número de dias maior que zero.");

  const row = {
    salon_id: membership.salon.id,
    name,
    category: String(formData.get("category") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents,
    duration_min,
    return_every_days,
  };

  const { data, error } = id
    ? await supabase.from("services").update(row).eq("id", id).select("id").single()
    : await supabase.from("services").insert(row).select("id").single();
  if (error) fail(error.message);

  // Novo serviço: já libera para todos os profissionais ativos
  if (!id && data) {
    const { data: pros } = await supabase
      .from("professionals")
      .select("id")
      .eq("salon_id", membership.salon.id)
      .eq("active", true);
    if (pros?.length) {
      await supabase
        .from("professional_services")
        .insert(pros.map((p) => ({ professional_id: p.id, service_id: data.id })));
    }
  }

  revalidatePath("/painel/servicos");
  redirect("/painel/servicos?ok=1");
}

export async function toggleService(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("services").update({ active: !active }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/painel/servicos");
}

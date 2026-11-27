"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIntOrNull, parsePriceToCents } from "@/lib/parse";
import { requireSalon } from "@/lib/session";

function fail(message: string): never {
  redirect(`/painel/pacotes?erro=${encodeURIComponent(message)}`);
}

async function requireOwner() {
  const ctx = await requireSalon();
  if (ctx.membership.role !== "owner") fail("Só o dono do salão cria e edita pacotes.");
  return ctx;
}

export async function savePackage(formData: FormData) {
  const { supabase, membership } = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price_cents = parsePriceToCents(formData.get("price"));
  const validity_days = parseIntOrNull(formData.get("validity_days"));

  if (name.length < 2) fail("Dê um nome ao pacote.");
  if (Number.isNaN(price_cents) || price_cents <= 0) fail("Preço inválido. Exemplo: 150,00");
  if (validity_days !== null && (validity_days < 1 || validity_days > 730)) fail("Validade deve ser entre 1 e 730 dias.");

  // quantidades: campos qty_<service_id>
  const items: { service_id: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const q = parseIntOrNull(value);
    if (q && q > 0) items.push({ service_id: key.slice(4), quantity: Math.min(q, 100) });
  }
  if (!items.length) fail("Coloque pelo menos um serviço no pacote (quantidade maior que zero).");

  const row = {
    salon_id: membership.salon.id,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents,
    validity_days,
  };
  const { data, error } = id
    ? await supabase.from("packages").update(row).eq("id", id).select("id").single()
    : await supabase.from("packages").insert(row).select("id").single();
  if (error || !data) fail(error?.message ?? "Não foi possível salvar.");

  // troca os itens (os pacotes já vendidos guardam a própria cópia e não mudam)
  const { error: delErr } = await supabase.from("package_items").delete().eq("package_id", data.id);
  if (delErr) fail(delErr.message);
  const { error: insErr } = await supabase
    .from("package_items")
    .insert(items.map((i) => ({ ...i, package_id: data.id })));
  if (insErr) fail(insErr.message);

  revalidatePath("/painel/pacotes");
  revalidatePath(`/${membership.salon.slug}`);
  redirect("/painel/pacotes?ok=1");
}

export async function togglePackage(formData: FormData) {
  const { supabase, membership } = await requireOwner();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("packages").update({ active: !active }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/painel/pacotes");
  revalidatePath(`/${membership.salon.slug}`);
}

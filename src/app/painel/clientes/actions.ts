"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIntOrNull, parsePriceToCents } from "@/lib/parse";
import { requireSalon } from "@/lib/session";

export async function saveClient(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const back = (p: string): never => redirect(`/painel/clientes/${id}?${p}`);

  const ret = parseIntOrNull(formData.get("return_every_days"));
  if (ret !== null && (ret < 1 || ret > 365)) back("erro=" + encodeURIComponent("Frequência deve ser entre 1 e 365 dias."));
  const birthday = String(formData.get("birthday") ?? "") || null;

  const { error } = await supabase
    .from("clients")
    .update({
      name: String(formData.get("name") ?? "").trim() || null,
      birthday,
      notes: String(formData.get("notes") ?? "").trim() || null,
      return_every_days: ret,
      accepts_marketing: formData.get("accepts_marketing") === "on",
    })
    .eq("id", id);
  if (error) back("erro=" + encodeURIComponent(error.message));
  revalidatePath("/painel/clientes");
  back("ok=1");
}

/** Cadastro manual (cliente que ainda não agendou pelo link). */
export async function createClientManual(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const fail = (m: string): never => redirect(`/painel/clientes?novo=1&erro=${encodeURIComponent(m)}`);
  let phone = String(formData.get("phone") ?? "").replace(/\D/g, "");
  if (!phone.startsWith("55")) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) fail("Telefone inválido. Use DDD + número, ex.: 11 99999-9999.");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail("Informe o nome do cliente.");
  const ret = parseIntOrNull(formData.get("return_every_days"));

  const { data, error } = await supabase
    .from("clients")
    .insert({
      salon_id: membership.salon.id,
      name,
      phone,
      birthday: String(formData.get("birthday") ?? "") || null,
      return_every_days: ret && ret > 0 && ret <= 365 ? ret : null,
    })
    .select("id")
    .single();
  if (error) fail(error.code === "23505" ? "Já existe um cliente com esse telefone." : error.message);
  revalidatePath("/painel/clientes");
  redirect(`/painel/clientes/${data!.id}?ok=novo`);
}

/** Atalho: só muda de quanto em quanto tempo o cliente deve voltar. */
export async function setReturnDays(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const ret = parseIntOrNull(formData.get("days"));
  await supabase
    .from("clients")
    .update({ return_every_days: ret && ret > 0 && ret <= 365 ? ret : null })
    .eq("id", id);
  revalidatePath(`/painel/clientes/${id}`);
  revalidatePath("/painel/clientes");
  redirect(`/painel/clientes/${id}?ok=retorno`);
}

// ---------------------------------------------------------------------
// Pacotes do cliente
// ---------------------------------------------------------------------
function backToClient(clientId: string, q: string): never {
  redirect(`/painel/clientes/${clientId}?${q}#pacotes`);
}

export async function sellPackage(formData: FormData) {
  const { supabase } = await requireSalon();
  const clientId = String(formData.get("client_id"));
  const packageId = String(formData.get("package_id") ?? "");
  if (!packageId) backToClient(clientId, "erro=" + encodeURIComponent("Escolha o pacote."));
  const raw = String(formData.get("price") ?? "").trim();
  const price = raw ? parsePriceToCents(raw) : null;
  if (price !== null && Number.isNaN(price)) backToClient(clientId, "erro=" + encodeURIComponent("Valor inválido."));
  const { error } = await supabase.rpc("sell_package", {
    p_client: clientId,
    p_package: packageId,
    p_price_cents: price,
    p_notes: String(formData.get("notes") ?? ""),
  });
  if (error) backToClient(clientId, "erro=" + encodeURIComponent(error.message));
  revalidatePath(`/painel/clientes/${clientId}`);
  backToClient(clientId, "ok=pacote");
}

export async function registerPackageUse(formData: FormData) {
  const { supabase } = await requireSalon();
  const clientId = String(formData.get("client_id"));
  const { error } = await supabase.rpc("use_package", {
    p_client_package: String(formData.get("client_package_id")),
    p_service: String(formData.get("service_id")),
    p_appointment: String(formData.get("appointment_id") ?? "") || null,
  });
  const back = String(formData.get("back") ?? "");
  if (back.startsWith("/painel/")) {
    if (error) redirect(`${back}${back.includes("?") ? "&" : "?"}erro=${encodeURIComponent(error.message)}`);
    revalidatePath(back.split("?")[0]);
    redirect(back);
  }
  if (error) backToClient(clientId, "erro=" + encodeURIComponent(error.message));
  revalidatePath(`/painel/clientes/${clientId}`);
  backToClient(clientId, "ok=uso");
}

export async function undoPackageUse(formData: FormData) {
  const { supabase } = await requireSalon();
  const clientId = String(formData.get("client_id"));
  const { error } = await supabase.rpc("undo_package_use", { p_use: String(formData.get("use_id")) });
  if (error) backToClient(clientId, "erro=" + encodeURIComponent(error.message));
  revalidatePath(`/painel/clientes/${clientId}`);
  backToClient(clientId, "ok=desfeito");
}

export async function cancelClientPackage(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const clientId = String(formData.get("client_id"));
  if (membership.role !== "owner") backToClient(clientId, "erro=" + encodeURIComponent("Só o dono pode cancelar um pacote vendido."));
  const { error } = await supabase
    .from("client_packages")
    .update({ status: "cancelled" })
    .eq("id", String(formData.get("client_package_id")));
  if (error) backToClient(clientId, "erro=" + encodeURIComponent(error.message));
  revalidatePath(`/painel/clientes/${clientId}`);
  backToClient(clientId, "ok=cancelado");
}

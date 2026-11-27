"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIntOrNull } from "@/lib/parse";
import { requireSalon } from "@/lib/session";
import { uploadImage } from "@/lib/upload";

export async function saveSettings(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const fail = (m: string): never => redirect(`/painel/configuracoes?erro=${encodeURIComponent(m)}`);
  if (membership.role !== "owner") fail("Só o dono pode mudar as configurações.");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail("Informe o nome do salão.");
  let whatsapp = String(formData.get("whatsapp") ?? "").replace(/\D/g, "");
  if (whatsapp && !whatsapp.startsWith("55")) whatsapp = `55${whatsapp}`;
  if (whatsapp && (whatsapp.length < 12 || whatsapp.length > 13)) fail("WhatsApp inválido.");

  const cancel = parseIntOrNull(formData.get("cancel_min_hours")) ?? 2;
  const inactive = parseIntOrNull(formData.get("inactive_after_days")) ?? 30;
  const loyalty = parseIntOrNull(formData.get("loyalty_visits"));
  if (loyalty !== null && (loyalty < 2 || loyalty > 50)) fail("O cartão fidelidade deve ter entre 2 e 50 visitas.");

  const images: { logo_url?: string | null; cover_url?: string | null } = {};
  try {
    const logo = await uploadImage(supabase, membership.salon.id, formData.get("logo"), "salao");
    const cover = await uploadImage(supabase, membership.salon.id, formData.get("cover"), "salao");
    if (logo) images.logo_url = logo;
    else if (formData.get("remove_logo") === "on") images.logo_url = null;
    if (cover) images.cover_url = cover;
    else if (formData.get("remove_cover") === "on") images.cover_url = null;
  } catch (e) {
    fail((e as Error).message);
  }

  const { error } = await supabase
    .from("salons")
    .update({
      ...images,
      name,
      whatsapp: whatsapp || null,
      address: String(formData.get("address") ?? "").trim() || null,
      instagram: String(formData.get("instagram") ?? "").trim().replace(/^@/, "") || null,
      cancel_min_hours: Math.max(0, cancel),
      inactive_after_days: Math.max(1, inactive),
      loyalty_visits: loyalty,
      loyalty_reward: String(formData.get("loyalty_reward") ?? "").trim() || null,
    })
    .eq("id", membership.salon.id);
  if (error) fail(error.message);
  revalidatePath("/painel", "layout");
  redirect("/painel/configuracoes?ok=1");
}

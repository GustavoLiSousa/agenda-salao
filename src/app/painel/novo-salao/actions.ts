"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidSlug, slugify } from "@/lib/slug";

export type NewSalonState = { error?: string };

export async function createSalon(_: NewSalonState, formData: FormData): Promise<NewSalonState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  let whatsapp = String(formData.get("whatsapp") ?? "").replace(/\D/g, "");
  if (whatsapp && !whatsapp.startsWith("55")) whatsapp = `55${whatsapp}`;

  if (name.length < 2) return { error: "Informe o nome do salão." };
  if (!isValidSlug(slug))
    return { error: "Escolha outro link: use pelo menos 3 letras ou números." };
  if (whatsapp && (whatsapp.length < 12 || whatsapp.length > 13))
    return { error: "WhatsApp inválido. Use DDD + número, ex.: 11 99999-9999." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_salon", {
    p_slug: slug,
    p_name: name,
    p_whatsapp: whatsapp || null,
  });

  if (error) {
    if (error.code === "23505") return { error: `O link /${slug} já está em uso. Escolha outro.` };
    return { error: error.message };
  }
  redirect("/painel");
}

/** Funcionário pede para entrar em um salão que já usa o app. */
export async function requestJoin(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_join_salon", {
    p_salon: String(formData.get("salon_id") ?? ""),
    p_name: String(formData.get("name") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
  });
  if (error) redirect(`/painel/novo-salao?modo=equipe&erro=${encodeURIComponent(error.message)}`);
  redirect("/painel/novo-salao?modo=equipe&ok=1");
}

export async function cancelJoin(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("cancel_join_request", { p_request: String(formData.get("id") ?? "") });
  redirect("/painel/novo-salao?modo=equipe");
}

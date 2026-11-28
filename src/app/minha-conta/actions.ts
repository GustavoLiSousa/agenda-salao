"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";
import { uploadImage } from "@/lib/upload";

export async function clientSignOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNext(String(formData.get("back") ?? ""), "/minha-conta/entrar"));
}

function back(formData: FormData, fallback = "/minha-conta") {
  return safeNext(String(formData.get("back") ?? ""), fallback);
}

/** Salvar / remover um salão como "meu salão". */
export async function toggleFavoriteSalon(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?aba=cliente");
  const salonId = String(formData.get("salon_id") ?? "");
  if (formData.get("saved") === "1") {
    await supabase.from("client_favorite_salons").delete().eq("user_id", user.id).eq("salon_id", salonId);
  } else {
    await supabase
      .from("client_favorite_salons")
      .upsert({ user_id: user.id, salon_id: salonId }, { ignoreDuplicates: true });
  }
  revalidatePath("/minha-conta");
  redirect(back(formData));
}

export type RequestState = { error?: string; done?: boolean };

/** Cliente pede um pacote; o salão confirma a venda no painel. */
export async function requestPackage(_: RequestState, formData: FormData): Promise<RequestState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_package", {
    p_package: String(formData.get("package_id") ?? ""),
    p_name: String(formData.get("name") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/minha-conta");
  return { done: true };
}

export async function cancelPackageRequest(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("cancel_package_request", { p_request: String(formData.get("id") ?? "") });
  revalidatePath("/minha-conta");
  redirect(back(formData));
}

/** Cliente edita o próprio perfil: foto, nome, WhatsApp e aniversário. */
export async function saveClientProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/minha-conta/entrar?next=/minha-conta/perfil");
  const fail = (m: string): never => redirect(`/minha-conta/perfil?erro=${encodeURIComponent(m)}`);

  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 80);
  const phone = String(formData.get("phone") ?? "")
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "");
  const birthday = String(formData.get("birthday") ?? "");
  if (!name) fail("Coloque o seu nome.");
  if (phone && (phone.length < 10 || phone.length > 11)) fail("Confira o WhatsApp com DDD (ex.: 11 99999-9999).");
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) fail("Data de aniversário inválida.");

  let avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;
  if (formData.get("remove_photo") === "on") avatar = null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    try {
      avatar = await uploadImage(supabase, user.id, file, "perfil");
    } catch (e) {
      fail((e as Error).message);
    }
  }

  const { error } = await supabase.auth.updateUser({
    data: { name, full_name: name, phone: phone || null, birthday: birthday || null, avatar_url: avatar },
  });
  if (error) fail(error.message);
  revalidatePath("/minha-conta");
  redirect("/minha-conta/perfil?ok=1");
}

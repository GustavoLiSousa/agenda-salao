"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";

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

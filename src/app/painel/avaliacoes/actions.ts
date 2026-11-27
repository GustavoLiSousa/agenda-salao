"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalon } from "@/lib/session";

export async function replyReview(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 600);
  const { error } = await supabase
    .from("reviews")
    .update({ reply: reply || null, replied_at: reply ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/painel/avaliacoes");
  redirect(`/painel/avaliacoes?${error ? "erro=" + encodeURIComponent(error.message) : "ok=1"}`);
}

export async function toggleHidden(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const hidden = formData.get("hidden") === "1";
  const { error } = await supabase.from("reviews").update({ hidden }).eq("id", id);
  revalidatePath("/painel/avaliacoes");
  redirect(`/painel/avaliacoes?${error ? "erro=" + encodeURIComponent(error.message) : "ok=1"}`);
}

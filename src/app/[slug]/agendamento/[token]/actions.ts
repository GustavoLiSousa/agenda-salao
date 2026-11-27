"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function cancelAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const token = String(formData.get("token"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_by_token", { p_token: token });
  if (error) {
    redirect(`/${slug}/agendamento/${token}?erro=${encodeURIComponent(error.message)}`);
  }
  redirect(`/${slug}/agendamento/${token}?desmarcado=1`);
}

export type ReviewState = { error?: string };

export async function submitReviewAction(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const slug = String(formData.get("slug"));
  const token = String(formData.get("token"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_token: token,
    p_salon_rating: Number(formData.get("salon_rating")),
    p_professional_rating: Number(formData.get("professional_rating")),
    p_comment: String(formData.get("comment") ?? ""),
  });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  redirect(`/${slug}/agendamento/${token}?avaliado=1#avaliar`);
}

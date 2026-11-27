"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BookState = { error?: string };

function cleanError(message: string) {
  // mensagens do banco já vêm em português; esconde detalhes técnicos
  return message.replace(/^.*?ERROR:\s*/, "");
}

export async function bookAction(_: BookState, formData: FormData): Promise<BookState> {
  const slug = String(formData.get("slug"));
  const startsAt = String(formData.get("starts_at") ?? "");
  const rescheduleToken = String(formData.get("remarcar") ?? "");
  if (!startsAt) return { error: "Escolha um horário." };

  const supabase = await createClient();

  if (rescheduleToken) {
    const { data, error } = await supabase.rpc("reschedule_by_token", {
      p_token: rescheduleToken,
      p_new_start: startsAt,
    });
    if (error) return { error: cleanError(error.message) };
    redirect(`/${slug}/agendamento/${data}?remarcado=1`);
  }

  const { data, error } = await supabase.rpc("book_as_guest", {
    p_professional: String(formData.get("professional_id")),
    p_service: String(formData.get("service_id")),
    p_starts_at: startsAt,
    p_name: String(formData.get("name") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
  });
  if (error) return { error: cleanError(error.message) };
  redirect(`/${slug}/agendamento/${data}?novo=1`);
}

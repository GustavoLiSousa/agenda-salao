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

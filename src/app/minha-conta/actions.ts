"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";

export async function clientSignOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNext(String(formData.get("back") ?? ""), "/minha-conta/entrar"));
}

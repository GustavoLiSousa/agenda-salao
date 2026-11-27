"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIntOrNull } from "@/lib/parse";
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

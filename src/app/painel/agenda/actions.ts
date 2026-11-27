"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalon } from "@/lib/session";
import { zonedToDate } from "@/lib/time";

function back(returnTo: string, params: string): never {
  const sep = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${sep}${params}`);
}

function safeReturn(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s.startsWith("/painel/agenda") ? s : "/painel/agenda";
}

export async function setStatus(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const returnTo = safeReturn(formData.get("return_to"));

  if (status === "cancelled") {
    const { error } = await supabase.rpc("cancel_appointment", {
      p_appointment: id,
      p_reason: "Desmarcado pelo salão",
    });
    if (error) back(returnTo, `erro=${encodeURIComponent(error.message)}`);
  } else if (["completed", "no_show", "confirmed"].includes(status)) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) back(returnTo, `erro=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/painel/agenda");
  redirect(returnTo);
}

export type StaffBookState = { error?: string };

export async function bookByStaff(_: StaffBookState, formData: FormData): Promise<StaffBookState> {
  const { supabase, membership } = await requireSalon();
  const day = String(formData.get("day") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!day || !time) return { error: "Escolha o dia e o horário." };
  const startsAt = zonedToDate(day, time, membership.salon.timezone).toISOString();

  const { error } = await supabase.rpc("book_by_staff", {
    p_professional: String(formData.get("professional_id")),
    p_service: String(formData.get("service_id")),
    p_starts_at: startsAt,
    p_name: String(formData.get("name") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
    p_notes: String(formData.get("notes") ?? ""),
  });
  if (error) return { error: error.message };

  revalidatePath("/painel/agenda");
  redirect(`/painel/agenda?data=${String(formData.get("day"))}&ok=1`);
}

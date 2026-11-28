"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

// Sem letras e números que se confundem (O/0, I/1)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Gera um novo código de convite para alguém criar um salão. */
export async function createInvite(formData: FormData) {
  const { supabase } = await requireUser();
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 80) || null;
  const days = Number(formData.get("days") ?? 0);
  const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const { error } = await supabase.from("salon_invite_codes").insert({
    code,
    note,
    expires_at: days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
  });
  if (error) redirect(`/painel/convites?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel/convites");
  redirect(`/painel/convites?novo=${code}`);
}

/** Cancela um código que ainda não foi usado. */
export async function revokeInvite(formData: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from("salon_invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", String(formData.get("code") ?? ""))
    .is("used_at", null);
  revalidatePath("/painel/convites");
  redirect("/painel/convites");
}

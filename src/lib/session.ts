import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Salon } from "@/lib/types";

export type Membership = {
  role: "owner" | "professional";
  professional_id: string | null;
  salon: Salon;
};

/** Usuário logado + salão dele. Sem login vai para /entrar. */
export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data } = await supabase
    .from("salon_members")
    .select("role, professional_id, salon:salons(*)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle<Membership>();

  return { supabase, user, membership: data };
}

/** Igual ao requireUser, mas exige já ter um salão. */
export async function requireSalon() {
  const ctx = await requireUser();
  if (!ctx.membership) redirect("/painel/novo-salao");
  return { ...ctx, membership: ctx.membership };
}

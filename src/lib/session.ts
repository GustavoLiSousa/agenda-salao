import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { can, type Permission } from "@/lib/permissions";
import type { Salon } from "@/lib/types";

export type Membership = {
  role: "owner" | "professional";
  professional_id: string | null;
  permissions: string[];
  salon: Salon;
};

/** Usuário logado + salão dele. Sem login vai para /entrar. (Uma vez por requisição.) */
export const requireUser = cache(async () => {
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data } = await supabase
    .from("salon_members")
    .select("role, professional_id, permissions, salon:salons(*)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle<Membership>();

  return { supabase, user, membership: data };
});

/** Igual ao requireUser, mas exige já ter um salão. */
export async function requireSalon() {
  const ctx = await requireUser();
  if (!ctx.membership) redirect("/painel/novo-salao");
  return { ...ctx, membership: ctx.membership };
}

/** Páginas só do dono (serviços, equipe, pacotes, ajustes...). Profissional volta para o início. */
export async function requireOwner() {
  const ctx = await requireSalon();
  if (ctx.membership.role !== "owner") redirect("/painel");
  return ctx;
}

/** Páginas que o dono pode liberar para o funcionário (ex.: tabela de preços). */
export async function requirePermission(p: Permission) {
  const ctx = await requireSalon();
  if (!can(ctx.membership, p)) redirect("/painel");
  return ctx;
}

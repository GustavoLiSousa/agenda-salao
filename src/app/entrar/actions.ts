"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message))
    return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/already registered/i.test(message)) return "Este e-mail já tem conta. Use \"Entrar\".";
  if (/at least 6 characters/i.test(message)) return "A senha precisa ter pelo menos 6 caracteres.";
  return message;
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: translate(error.message) };
  redirect("/painel");
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/painel`,
      data: { full_name: String(formData.get("name") ?? "").trim() },
    },
  });
  if (error) return { error: translate(error.message) };
  // E-mail já cadastrado: o Supabase responde "sucesso" sem sessão e sem identidades.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: "Este e-mail já tem conta. Use \"Entrar\"." };
  }
  // Com "Confirm email" ligado no Supabase, a sessão só existe depois do clique no e-mail.
  if (!data.session) {
    return {
      message:
        "Conta criada! Enviamos um link para o seu e-mail. Clique nele para entrar.",
    };
  }
  redirect("/painel");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

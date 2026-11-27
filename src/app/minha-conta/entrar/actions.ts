"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";

export type ClientAuthState = { error?: string; sentTo?: string };

/** Depois de entrar com código: o cliente cria (ou troca, se esqueceu) a senha. */
export async function afterCodeLogin(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Dono ou profissional do salão já tem senha (a mesma do painel): não pede outra.
    const { count } = await supabase
      .from("salon_members")
      .select("salon_id", { count: "exact", head: true })
      .eq("user_id", data.user.id);
    if (count) return next;
    return `/minha-conta/criar-senha?next=${encodeURIComponent(next)}`;
  }
  return next;
}

function translate(message: string) {
  if (/provider is not enabled|unsupported provider/i.test(message))
    return "O login com Google ainda não foi ativado neste salão. Use o código por e-mail.";
  if (/rate limit|too many|security purposes/i.test(message))
    return "Muitos pedidos de código em pouco tempo. Espere um minuto e tente de novo.";
  if (/invalid login credentials/i.test(message))
    return "E-mail ou senha incorretos. Se é seu primeiro acesso ou esqueceu a senha, entre com o código por e-mail.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail: entre com o código por e-mail.";
  if (/should be different/i.test(message)) return "Essa já é a sua senha atual.";
  if (/password should be|weak/i.test(message)) return "Senha fraca. Use pelo menos 6 letras ou números.";
  if (/expired|invalid/i.test(message)) return "Código inválido ou vencido. Confira ou peça um novo.";
  if (/signups not allowed/i.test(message)) return "Cadastro de novas contas está desligado no momento.";
  return message;
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function googleSignIn(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    redirect(`/minha-conta/entrar?next=${encodeURIComponent(next)}&erro=${encodeURIComponent(translate(error?.message ?? "Não foi possível abrir o Google."))}`);
  }
  redirect(data.url);
}

export async function sendCode(_: ClientAuthState, formData: FormData): Promise<ClientAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Digite um e-mail válido." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: translate(error.message) };
  return { sentTo: email };
}

export async function verifyCode(_: ClientAuthState, formData: FormData): Promise<ClientAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (token.length < 6) return { sentTo: email, error: "Digite o código que chegou no e-mail." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { sentTo: email, error: translate(error.message) };
  redirect(await afterCodeLogin(next));
}

export async function passwordSignIn(_: ClientAuthState, formData: FormData): Promise<ClientAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Digite um e-mail válido." };
  if (!password) return { error: "Digite sua senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translate(error.message) };
  redirect(next);
}

export async function createPassword(_: ClientAuthState, formData: FormData): Promise<ClientAuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (password.length < 6) return { error: "A senha precisa ter pelo menos 6 letras ou números." };
  if (password !== confirm) return { error: "As duas senhas não são iguais." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/minha-conta/entrar?next=${encodeURIComponent(next)}`);
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
  if (error && !/should be different/i.test(error.message)) return { error: translate(error.message) };
  if (error) await supabase.auth.updateUser({ data: { has_password: true } });
  redirect(next);
}

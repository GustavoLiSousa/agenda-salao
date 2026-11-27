"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/client-area";

export type ClientAuthState = { error?: string; sentTo?: string };

function translate(message: string) {
  if (/provider is not enabled|unsupported provider/i.test(message))
    return "O login com Google ainda não foi ativado neste salão. Use o código por e-mail.";
  if (/rate limit|too many|security purposes/i.test(message))
    return "Muitos pedidos de código em pouco tempo. Espere um minuto e tente de novo.";
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
  redirect(next);
}

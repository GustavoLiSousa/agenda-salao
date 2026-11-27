import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Para onde o link do e-mail de confirmação leva.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/painel";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // O Supabase devolve o erro na URL quando o link é inválido ou já foi usado.
  // Login do cliente (área "Meus agendamentos") volta para a tela do cliente.
  const failure = next.startsWith("/minha-conta")
    ? `${origin}/minha-conta/entrar?erro=1&next=${encodeURIComponent(next)}`
    : `${origin}/entrar?erro=confirmacao`;

  if (searchParams.get("error") || searchParams.get("error_description")) {
    return NextResponse.redirect(failure);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    if (next.startsWith("/minha-conta")) return NextResponse.redirect(failure);
    // O Supabase só manda `code` depois de confirmar o e-mail. Se a troca falhou
    // (ex.: link aberto em outro navegador/app, sem o cookie do cadastro),
    // o e-mail já está confirmado: basta entrar com e-mail e senha.
    return NextResponse.redirect(`${origin}/entrar?confirmado=1`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(failure);
}

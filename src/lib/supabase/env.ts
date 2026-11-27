/**
 * Lê as chaves do Supabase das variáveis de ambiente.
 * Aceita a URL colada com sobras comuns (barra no fim, /rest/v1, espaços)
 * e devolve só o endereço base, ex.: https://abcd.supabase.co
 */
export function supabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  let url = rawUrl.trim().replace(/^["']|["']$/g, "");
  try {
    if (url) url = new URL(url).origin;
  } catch {
    url = url.replace(/\/(rest|auth)\/v1.*$/, "").replace(/\/+$/, "");
  }
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = supabaseEnv();
  return Boolean(url && key);
}

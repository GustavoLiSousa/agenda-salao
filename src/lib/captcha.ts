// Anti-robô (Cloudflare Turnstile). Só fica ativo quando as chaves estão
// configuradas na Vercel: NEXT_PUBLIC_TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY.
export async function captchaOk(formData: FormData): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare fora do ar: não trava o salão; o limite no banco continua valendo
    return true;
  }
}

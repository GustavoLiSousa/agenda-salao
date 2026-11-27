import { createBrowserClient } from "@supabase/ssr";

/** Cliente do Supabase para usar em componentes do navegador ("use client"). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

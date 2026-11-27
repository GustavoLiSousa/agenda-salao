import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** Cliente do Supabase para usar em componentes do navegador ("use client"). */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}

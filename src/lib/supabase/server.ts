import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseEnv } from "./env";

export { isSupabaseConfigured };

/** Cliente do Supabase para páginas e ações no servidor. */
export async function createClient() {
  const cookieStore = await cookies();

  const { url, key } = supabaseEnv();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: não dá para gravar cookie aqui.
          }
        },
      },
    },
  );
}

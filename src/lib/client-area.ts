import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Links pessoais dos agendamentos feitos neste aparelho. Quando o cliente
// entra na conta, eles são usados para ligar o login ao cadastro dele.
export const BOOKINGS_COOKIE = "agenda_reservas";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readBookingTokens() {
  const raw = (await cookies()).get(BOOKINGS_COOKIE)?.value ?? "";
  return raw.split(".").filter((t) => UUID.test(t));
}

/** Guarda o link de um agendamento novo (só em Server Actions/Route Handlers). */
export async function rememberBookingToken(token: string) {
  if (!UUID.test(token)) return;
  const store = await cookies();
  const tokens = [token, ...(await readBookingTokens()).filter((t) => t !== token)].slice(0, 20);
  store.set(BOOKINGS_COOKIE, tokens.join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Liga o login atual aos agendamentos (pelos links pessoais). */
export async function claimTokens(supabase: SupabaseClient, tokens: string[]) {
  await Promise.all(
    tokens.filter((t) => UUID.test(t)).map((t) => supabase.rpc("claim_appointment", { p_token: t })),
  );
}

/** Endereço seguro para voltar depois do login (só caminhos do próprio site). */
export function safeNext(next: string | null | undefined, fallback = "/minha-conta") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export type MyAppointment = {
  manage_token: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  starts_at: string;
  ends_at: string;
  price_cents: number;
  service_name: string;
  professional_name: string;
  professional_photo: string | null;
  salon_name: string;
  salon_slug: string;
  salon_logo: string | null;
  salon_whatsapp: string | null;
  salon_address: string | null;
  salon_timezone: string;
  cancel_min_hours: number;
  reviewed?: boolean;
};

export type MyPackage = {
  id: string;
  name: string;
  status: string;
  purchased_at: string;
  expires_at: string | null;
  salon_name: string;
  salon_slug: string;
  items: { service: string; quantity: number; used: number }[];
};

export type MyPackageRequest = {
  id: string;
  status: "pending" | "sold" | "declined" | "cancelled";
  created_at: string;
  package_id: string;
  package_name: string;
  price_cents: number;
  salon_name: string;
  salon_slug: string;
};

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";

export type AppointmentView = {
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  client_name: string | null;
  service_id: string;
  service_name: string;
  professional_id: string;
  professional_name: string;
  salon_name: string;
  salon_slug: string;
  salon_whatsapp: string | null;
  salon_address: string | null;
  salon_timezone: string;
  cancel_min_hours: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAppointmentByToken(token: string) {
  if (!UUID.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("appointment_by_token", { p_token: token })
    .maybeSingle<AppointmentView>();
  return data;
}

export function calendarEventFor(a: AppointmentView) {
  return {
    title: `${a.service_name} - ${a.salon_name}`,
    details: `Com ${a.professional_name}.`,
    location: a.salon_address,
    start: new Date(a.starts_at),
    end: new Date(a.ends_at),
  };
}

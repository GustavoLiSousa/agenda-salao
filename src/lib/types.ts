// Tipos das tabelas principais (espelham supabase/migrations).

export type Salon = {
  id: string;
  slug: string;
  name: string;
  whatsapp: string | null;
  address: string | null;
  instagram: string | null;
  logo_url: string | null;
  timezone: string;
  cancel_min_hours: number;
  inactive_after_days: number;
  loyalty_visits: number | null;
  loyalty_reward: string | null;
};

export type Professional = {
  id: string;
  salon_id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  active: boolean;
  slot_step_min: number;
  release_mode: "rolling" | "weekly";
  release_days_ahead: number;
  release_weekday: number | null;
  release_time: string | null;
  release_weeks_ahead: number;
};

export type Service = {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  duration_min: number;
  return_every_days: number | null;
  active: boolean;
};

export type AppointmentStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

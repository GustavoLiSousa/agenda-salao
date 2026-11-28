import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey, formatTime } from "./time";

export type FreePro = { id: string; name: string; slot_step_min: number; photo_url: string | null };
export type FreeResult = { pro: FreePro; byDay: Map<string, string[]> };

/** Junta horários seguidos em faixas: 09:00–11:30 */
export function toRanges(starts: string[], stepMin: number, durMin: number, tz: string) {
  const out: string[] = [];
  let first: number | null = null;
  let last: number | null = null;
  const flush = () => {
    if (first === null || last === null) return;
    out.push(`${formatTime(new Date(first), tz)}–${formatTime(new Date(last + durMin * 60_000), tz)}`);
  };
  for (const s of starts.map((x) => Date.parse(x))) {
    if (last !== null && s - last <= stepMin * 60_000) {
      last = s;
      continue;
    }
    flush();
    first = s;
    last = s;
  }
  flush();
  return out;
}

/**
 * Horários livres de cada profissional entre dois dias, usando o serviço mais curto que ele faz.
 * byDay guarda os inícios (ISO) de cada dia.
 */
export async function freeSlots(
  supabase: SupabaseClient,
  salonId: string,
  from: string,
  to: string,
  onlyPro?: string | null,
): Promise<(FreeResult & { dur: number })[]> {
  let prosQuery = supabase
    .from("professionals")
    .select("id, name, slot_step_min, photo_url")
    .eq("salon_id", salonId)
    .eq("active", true)
    .order("name");
  if (onlyPro) prosQuery = prosQuery.eq("id", onlyPro);
  const { data: pros } = await prosQuery.returns<FreePro[]>();

  const { data: links } = await supabase
    .from("professional_services")
    .select("professional_id, service_id, duration_min, service:services(duration_min, active)")
    .in(
      "professional_id",
      (pros ?? []).map((p) => p.id),
    )
    .returns<
      {
        professional_id: string;
        service_id: string;
        duration_min: number | null;
        service: { duration_min: number; active: boolean } | null;
      }[]
    >();

  const tzRow = await supabase.from("salons").select("timezone").eq("id", salonId).single<{ timezone: string }>();
  const tz = tzRow.data?.timezone ?? "America/Sao_Paulo";

  return Promise.all(
    (pros ?? []).map(async (p) => {
      const opts = (links ?? [])
        .filter((l) => l.professional_id === p.id && l.service?.active)
        .map((l) => ({ id: l.service_id, dur: l.duration_min ?? l.service!.duration_min }))
        .sort((a, b) => a.dur - b.dur);
      const byDay = new Map<string, string[]>();
      if (!opts.length) return { pro: p, byDay, dur: 30 };
      const { data } = await supabase.rpc("available_slots", {
        p_professional: p.id,
        p_service: opts[0].id,
        p_from: from,
        p_to: to,
      });
      for (const r of (data ?? []) as { starts_at: string }[]) {
        const k = dayKey(r.starts_at, tz);
        byDay.set(k, [...(byDay.get(k) ?? []), r.starts_at]);
      }
      return { pro: p, byDay, dur: opts[0].dur };
    }),
  );
}

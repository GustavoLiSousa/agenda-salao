import { headers } from "next/headers";
import { freeSlots } from "@/lib/free-slots";
import { can } from "@/lib/permissions";
import { requireSalon } from "@/lib/session";
import { freeArt } from "@/lib/free-art";
import { isValidDay, todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Arte (PNG) com os horários livres do dia, para o profissional postar nas redes. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const tz = salon.timezone;
  const day = isValidDay(url.searchParams.get("data") ?? undefined) ? url.searchParams.get("data")! : todayIn(tz, 1);
  const onlyMine = !can(membership, "agenda_equipe");
  const prof = onlyMine
    ? (membership.professional_id ?? "00000000-0000-0000-0000-000000000000")
    : url.searchParams.get("prof");

  const list = (await freeSlots(supabase, salon.id, day, day, prof)).filter((x) => x.byDay.get(day)?.length);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return freeArt({ salon, list, day, host, tz });
}

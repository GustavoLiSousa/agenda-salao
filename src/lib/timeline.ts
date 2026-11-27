// Linha do tempo de um dia de um profissional: horários marcados, bloqueios e
// as janelas livres dentro do expediente configurado dele.
import { dayKey, formatTime } from "./time";

export type Busy<T> = { kind: "appt" | "block"; start: number; end: number; ref: T };
export type Segment<T> = Busy<T> | { kind: "free"; start: number; end: number };

/** "09:30" ou "09:30:00" -> minutos desde a meia-noite */
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Minutos do dia (no fuso do salão) de um instante; antes do dia = 0, depois = 1440 */
export function minutesInDay(iso: string, day: string, tz: string) {
  const k = dayKey(iso, tz);
  if (k < day) return 0;
  if (k > day) return 24 * 60;
  return toMin(formatTime(iso, tz));
}

export function buildTimeline<T>(
  periods: { start: number; end: number }[],
  busy: Busy<T>[],
  minFree = 15,
): Segment<T>[] {
  const out: Segment<T>[] = [...busy];
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  for (const p of periods) {
    let cursor = p.start;
    for (const b of sorted) {
      if (b.end <= cursor || b.start >= p.end) continue;
      if (b.start - cursor >= minFree) out.push({ kind: "free", start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (p.end - cursor >= minFree) out.push({ kind: "free", start: cursor, end: p.end });
  }
  return out.sort((a, b) => a.start - b.start || (a.kind === "free" ? 1 : -1));
}

// Horário de funcionamento do salão, calculado a partir do expediente
// dos profissionais ativos (junta os intervalos de todos em cada dia).

export type WorkingHourRow = { weekday: number; start_time: string; end_time: string };
export type Interval = { start: string; end: string }; // "09:00"

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** 7 listas (domingo..sábado) de intervalos já unidos e ordenados. */
export function openingHours(rows: WorkingHourRow[]): Interval[][] {
  return WEEKDAYS.map((_, day) => {
    const spans = rows
      .filter((r) => r.weekday === day)
      .map((r) => [toMin(r.start_time), toMin(r.end_time)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [s, e] of spans) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
    return merged.map(([s, e]) => ({ start: toHHMM(s), end: toHHMM(e) }));
  });
}

/** Situação agora, no fuso do salão: "Aberto até 19:00" / "Fechado · abre amanhã às 09:00". */
export function openStatus(hours: Interval[][], timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  const minutes = Number(parts.find((p) => p.type === "hour")!.value) * 60 + Number(parts.find((p) => p.type === "minute")!.value);

  const current = hours[day].find((i) => toMin(i.start) <= minutes && minutes < toMin(i.end));
  if (current) return { open: true, today: day, label: `Aberto agora · até ${current.end}` };

  for (let add = 0; add < 7; add++) {
    const d = (day + add) % 7;
    const next = hours[d].find((i) => add > 0 || toMin(i.start) > minutes);
    if (next) {
      const when = add === 0 ? "hoje" : add === 1 ? "amanhã" : WEEKDAYS[d].toLowerCase();
      return { open: false, today: day, label: `Fechado · abre ${when} às ${next.start}` };
    }
  }
  return { open: false, today: day, label: "Fechado" };
}

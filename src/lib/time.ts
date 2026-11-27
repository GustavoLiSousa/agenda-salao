/** Diferença (ms) entre o horário local do fuso e UTC num dado instante. */
function tzOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** "2026-12-01" + "09:30" no fuso do salão -> Date (instante real). */
export function zonedToDate(day: string, time: string, timeZone: string) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  const result = new Date(guess - offset);
  // ajuste fino em virada de horário de verão
  const offset2 = tzOffsetMs(result, timeZone);
  return offset2 === offset ? result : new Date(guess - offset2);
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Data de hoje (AAAA-MM-DD) no fuso do salão. */
export function todayIn(timeZone: string, addDays = 0) {
  const d = new Date(Date.now() + addDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
}

/** Dia (AAAA-MM-DD) de um instante no fuso do salão. */
export function dayKey(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

export function formatTime(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatLongDate(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

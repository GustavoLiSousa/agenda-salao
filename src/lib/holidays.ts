// Feriados nacionais do Brasil e datas comemorativas, calculados para qualquer ano.

export type Holiday = { day: string; name: string; kind: "feriado" | "ponto" | "comemorativa" };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(y: number) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

const shift = (base: Date, days: number) => {
  const d = new Date(base.getTime() + days * 86_400_000);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** N-ésimo domingo do mês (mês 1–12). */
function nthSunday(y: number, m: number, n: number) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return ymd(y, m, 1 + ((7 - first) % 7) + (n - 1) * 7);
}

export function holidaysOf(y: number): Holiday[] {
  const e = easter(y);
  const list: Holiday[] = [
    { day: ymd(y, 1, 1), name: "Confraternização Universal", kind: "feriado" },
    { day: shift(e, -48), name: "Carnaval (segunda)", kind: "ponto" },
    { day: shift(e, -47), name: "Carnaval (terça)", kind: "ponto" },
    { day: shift(e, -46), name: "Quarta-feira de Cinzas", kind: "ponto" },
    { day: shift(e, -2), name: "Sexta-feira Santa", kind: "feriado" },
    { day: shift(e, 0), name: "Páscoa", kind: "comemorativa" },
    { day: ymd(y, 4, 21), name: "Tiradentes", kind: "feriado" },
    { day: ymd(y, 5, 1), name: "Dia do Trabalho", kind: "feriado" },
    { day: nthSunday(y, 5, 2), name: "Dia das Mães", kind: "comemorativa" },
    { day: shift(e, 60), name: "Corpus Christi", kind: "ponto" },
    { day: ymd(y, 6, 12), name: "Dia dos Namorados", kind: "comemorativa" },
    { day: nthSunday(y, 8, 2), name: "Dia dos Pais", kind: "comemorativa" },
    { day: ymd(y, 9, 7), name: "Independência do Brasil", kind: "feriado" },
    { day: ymd(y, 10, 12), name: "Nossa Senhora Aparecida", kind: "feriado" },
    { day: ymd(y, 11, 2), name: "Finados", kind: "feriado" },
    { day: ymd(y, 11, 15), name: "Proclamação da República", kind: "feriado" },
    { day: ymd(y, 11, 20), name: "Consciência Negra", kind: "feriado" },
    { day: ymd(y, 12, 24), name: "Véspera de Natal", kind: "ponto" },
    { day: ymd(y, 12, 25), name: "Natal", kind: "feriado" },
    { day: ymd(y, 12, 31), name: "Véspera de Ano Novo", kind: "ponto" },
  ];
  return list.sort((a, b) => a.day.localeCompare(b.day));
}

/** Feriados e datas a partir de hoje pelos próximos 12 meses. */
export function upcomingHolidays(today: string): Holiday[] {
  const y = Number(today.slice(0, 4));
  const limit = `${y + 1}${today.slice(4)}`;
  return [...holidaysOf(y), ...holidaysOf(y + 1)].filter((h) => h.day >= today && h.day < limit);
}

export const HOLIDAY_KIND: Record<Holiday["kind"], { label: string; cls: string }> = {
  feriado: { label: "Feriado nacional", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  ponto: { label: "Ponto facultativo", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  comemorativa: {
    label: "Data comemorativa",
    cls: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  },
};

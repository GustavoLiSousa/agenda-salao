/** "40", "40,00", "R$ 1.234,50" -> centavos */
export function parsePriceToCents(input: FormDataEntryValue | null) {
  const raw = String(input ?? "")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const value = Math.round(Number(normalized) * 100);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function parseIntOrNull(input: FormDataEntryValue | null) {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

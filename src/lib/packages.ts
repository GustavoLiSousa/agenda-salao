export type PackageItem = { service_id: string; quantity: number; service?: { name: string; price_cents: number; active: boolean; archived_at?: string | null } | null };

export type SalonPackage = {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  validity_days: number | null;
  active: boolean;
  sort_order: number;
  items: PackageItem[];
};

export type ClientPackage = {
  id: string;
  name: string;
  price_cents: number;
  purchased_at: string;
  expires_at: string | null;
  status: "active" | "cancelled";
  notes: string | null;
  items: { service_id: string; quantity: number; used: number; service: { name: string } | null }[];
  uses: { id: string; service_id: string; used_at: string; undone_at: string | null }[];
};

/** Valor dos serviços avulsos (para mostrar a economia). */
export function fullPrice(items: PackageItem[]) {
  return items.reduce((sum, i) => sum + (i.service?.price_cents ?? 0) * i.quantity, 0);
}

export function itemsLabel(items: { quantity: number; service?: { name: string } | null }[]) {
  return items.map((i) => `${i.quantity}x ${i.service?.name ?? "serviço"}`).join(" + ");
}

export function validityLabel(days: number | null) {
  if (!days) return "Sem prazo para usar";
  if (days % 30 === 0) return `Use em até ${days / 30} ${days === 30 ? "mês" : "meses"}`;
  return `Use em até ${days} dias`;
}

export function isExpired(cp: { expires_at: string | null }) {
  return !!cp.expires_at && new Date(cp.expires_at).getTime() < Date.now();
}

export function remaining(cp: { items: { quantity: number; used: number }[] }) {
  return cp.items.reduce((s, i) => s + (i.quantity - i.used), 0);
}

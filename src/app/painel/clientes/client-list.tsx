"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Badge } from "@/components/ui";
import {
  birthdayMessage,
  comeBackMessage,
  daysSince,
  LEAD_LABEL,
  RETURN_SOURCE_LABEL,
  type ClientStats,
  type LeadStatus,
} from "@/lib/clients";
import { formatPhone, formatPrice, whatsappLink } from "@/lib/format";

type Item = { c: ClientStats; st: LeadStatus; birthdayMonth: boolean; isNew: boolean };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "voltar", label: "Chamar de volta" },
  { key: "agendados", label: "Agendados" },
  { key: "aniversario", label: "Aniversariantes" },
  { key: "novos", label: "Novos" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const SORTS = {
  nome: "Nome (A–Z)",
  ultima: "Sem vir há mais tempo",
  visitas: "Mais visitas",
  gasto: "Mais gasto",
} as const;
type Sort = keyof typeof SORTS;

const match: Record<Filter, (x: Item) => boolean> = {
  todos: () => true,
  voltar: (x) => x.st === "sumido" || x.st === "vencendo",
  agendados: (x) => x.st === "agendado",
  aniversario: (x) => x.birthdayMonth,
  novos: (x) => x.isNew,
};

export function ClientList({
  items,
  salonName,
  bookingLink,
  initialFilter,
}: {
  items: Item[];
  salonName: string;
  bookingLink: string;
  initialFilter: Filter;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>(initialFilter === "voltar" ? "ultima" : "nome");

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    const out = items.filter(
      (x) =>
        match[filter](x) &&
        (!s || (x.c.name ?? "").toLowerCase().includes(s) || (digits.length >= 3 && x.c.phone.includes(digits))),
    );
    const by: Record<Sort, (a: Item, b: Item) => number> = {
      nome: (a, b) => (a.c.name ?? "").localeCompare(b.c.name ?? "", "pt-BR"),
      ultima: (a, b) => (daysSince(b.c.last_visit_at) ?? -1) - (daysSince(a.c.last_visit_at) ?? -1),
      visitas: (a, b) => b.c.visits - a.c.visits,
      gasto: (a, b) => b.c.total_spent_cents - a.c.total_spent_cents,
    };
    return out.sort(by[sort]);
  }, [items, filter, search, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[57px] z-10 -mx-4 flex flex-col gap-3 bg-[var(--background)]/95 px-4 py-2 backdrop-blur">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pr-3 pl-11 text-base shadow-sm outline-none focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
            {FILTERS.map((f) => {
              const n = items.filter(match[f.key]).length;
              const on = f.key === filter;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                      : "border-stone-300 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                  }`}
                >
                  {f.label}
                  <span className={`text-xs ${on ? "opacity-70" : "text-stone-400"}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <label className="flex items-center justify-end gap-2 text-xs text-stone-500">
          Ordenar por
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">
          {search ? "Ninguém encontrado com essa busca." : filter === "voltar" ? "Ninguém atrasado. Ótimo!" : "Nenhum cliente aqui ainda."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {list.map(({ c, st }) => {
            const since = daysSince(c.last_visit_at);
            const late = st === "sumido" || st === "vencendo";
            const msg = filter === "aniversario" ? birthdayMessage(c, salonName, bookingLink) : comeBackMessage(c, salonName, bookingLink);
            return (
              <li key={c.client_id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50 dark:hover:bg-stone-800/50">
                <Avatar name={c.name} size={42} />
                <Link href={`/painel/clientes/${c.client_id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.name ?? "Sem nome"}</p>
                    <Badge className={LEAD_LABEL[st].cls}>{LEAD_LABEL[st].label}</Badge>
                  </div>
                  <p className="text-xs text-stone-500">
                    {formatPhone(c.phone)}
                    {since !== null ? ` · última visita há ${since} dia${since === 1 ? "" : "s"}` : " · ainda não veio"}
                  </p>
                  <p className="text-xs text-stone-400">
                    {c.visits} visita{c.visits === 1 ? "" : "s"}
                    {c.total_spent_cents ? ` · ${formatPrice(c.total_spent_cents)}` : ""}
                    {c.return_every_days
                      ? ` · volta a cada ${c.return_every_days} dias${c.return_source ? ` (${RETURN_SOURCE_LABEL[c.return_source]})` : ""}`
                      : ""}
                  </p>
                </Link>
                <a
                  href={whatsappLink(c.phone, late || filter === "aniversario" ? msg : `Olá ${c.name ?? ""}! Aqui é do ${salonName}.`)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className={`flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold ${
                    late || filter === "aniversario"
                      ? "bg-[#1f9d55] text-white"
                      : "border border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300"
                  }`}
                >
                  {filter === "aniversario" ? "Parabéns" : late ? "Chamar" : "WhatsApp"}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

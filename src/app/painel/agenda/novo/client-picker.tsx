"use client";

import { useMemo, useState } from "react";
import { Avatar, Field, inputClass } from "@/components/ui";
import { formatPhone } from "@/lib/format";

export type PickerClient = { id: string; name: string | null; phone: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

/**
 * Escolhe um cliente já cadastrado (busca por nome ou telefone) para não duplicar.
 * Se não achar, cadastra um novo com nome e WhatsApp (ele entra na lista de clientes).
 */
export function ClientPicker({
  clients,
  initialName = "",
  initialPhone = "",
}: {
  clients: PickerClient[];
  initialName?: string;
  initialPhone?: string;
}) {
  const initial = initialPhone ? clients.find((c) => digits(c.phone) === digits(initialPhone)) : undefined;
  const [picked, setPicked] = useState<PickerClient | null>(initial ?? null);
  const [mode, setMode] = useState<"buscar" | "novo">(initialPhone && !initial ? "novo" : "buscar");
  const [query, setQuery] = useState("");
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(digits(initialPhone));

  const matches = useMemo(() => {
    const q = norm(query.trim());
    const d = digits(query);
    if (q.length < 2 && d.length < 3) return [];
    return clients
      .filter(
        (c) => (d.length >= 3 && digits(c.phone).includes(d)) || (q.length >= 2 && norm(c.name ?? "").includes(q)),
      )
      .slice(0, 8);
  }, [clients, query]);

  // Ao digitar o WhatsApp de um cliente novo, avisa se ele já existe
  const existing =
    mode === "novo" && digits(phone).length >= 10 ? clients.find((c) => digits(c.phone) === digits(phone)) : undefined;

  if (picked) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Cliente</span>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <Avatar name={picked.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{picked.name ?? "Sem nome"}</p>
            <p className="text-xs text-stone-500">{formatPhone(picked.phone)} · já cadastrado</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setQuery("");
            }}
            className="text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            Trocar
          </button>
        </div>
        <input type="hidden" name="name" value={picked.name ?? ""} />
        <input type="hidden" name="phone" value={picked.phone} />
      </div>
    );
  }

  if (mode === "novo") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Novo cliente</span>
          <button
            type="button"
            onClick={() => setMode("buscar")}
            className="text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            Buscar cadastrado
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do cliente" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Field
            label="WhatsApp do cliente"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="11 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        {existing ? (
          <button
            type="button"
            onClick={() => setPicked(existing)}
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            Esse WhatsApp já é de <b>{existing.name ?? "um cliente"}</b>. Toque para usar o cadastro dele.
          </button>
        ) : (
          <p className="text-xs text-stone-500">Ele será salvo na sua lista de clientes.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Cliente</span>
        <input
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busque pelo nome ou WhatsApp"
          autoComplete="off"
        />
      </label>
      {/* Campos vazios: o formulário avisa se ninguém foi escolhido */}
      <input type="hidden" name="name" value="" />
      <input type="hidden" name="phone" value="" />
      {matches.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setPicked(c)}
                className="flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800"
              >
                <Avatar name={c.name} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name ?? "Sem nome"}</span>
                  <span className="block text-xs text-stone-500">{formatPhone(c.phone)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(query.trim().length >= 2 || digits(query).length >= 3) && matches.length === 0 && (
        <p className="text-sm text-stone-500">Nenhum cliente encontrado.</p>
      )}
      <button
        type="button"
        onClick={() => {
          const d = digits(query);
          if (d.length >= 8) setPhone(d);
          else if (query.trim()) setName(query.trim());
          setMode("novo");
        }}
        className="self-start rounded-lg border border-dashed border-stone-400 px-3 py-1.5 text-sm font-medium dark:border-stone-600"
      >
        + Cadastrar novo cliente
      </button>
    </div>
  );
}

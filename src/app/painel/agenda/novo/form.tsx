"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Field, Notice, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/time";
import { bookByStaff, type StaffBookState } from "../actions";

type Props = {
  tz: string;
  day: string;
  professionals: { id: string; name: string }[];
  services: { id: string; name: string }[];
  links: { professional_id: string; service_id: string }[];
  initialProfessional: string;
  initialTime?: string;
  initialName?: string;
  initialPhone?: string;
};

export function StaffBookingForm({ tz, day: initialDay, professionals, services, links, initialProfessional, initialTime, initialName, initialPhone }: Props) {
  const [state, action, pending] = useActionState<StaffBookState, FormData>(bookByStaff, {});
  const [pro, setPro] = useState(initialProfessional || professionals[0]?.id || "");
  const servicesForPro = services.filter((s) => links.some((l) => l.professional_id === pro && l.service_id === s.id));
  const [service, setService] = useState(servicesForPro[0]?.id ?? "");
  const [day, setDay] = useState(initialDay);
  const [time, setTime] = useState(initialTime ?? "");
  const [free, setFree] = useState<string[] | null>(null);

  useEffect(() => {
    if (!servicesForPro.some((s) => s.id === service)) setService(servicesForPro[0]?.id ?? "");
  }, [pro, service, servicesForPro]);

  useEffect(() => {
    setFree(null);
    if (!pro || !service || !day) return;
    let cancelled = false;
    createClient()
      .rpc("available_slots", { p_professional: pro, p_service: service, p_from: day, p_to: day })
      .then(({ data }) => {
        if (!cancelled) setFree(((data ?? []) as { starts_at: string }[]).map((r) => formatTime(r.starts_at, tz)));
      });
    return () => {
      cancelled = true;
    };
  }, [pro, service, day, tz]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Profissional" name="professional_id" value={pro} onChange={(e) => setPro(e.target.value)}>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Serviço" name="service_id" value={service} onChange={(e) => setService(e.target.value)}>
          {servicesForPro.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Field label="Dia" name="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        <Field label="Horário" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </div>
      <div className="text-sm">
        <p className="mb-1 text-stone-500">Horários livres neste dia (toque para escolher):</p>
        {free === null ? (
          <p className="text-stone-400">Carregando...</p>
        ) : free.length === 0 ? (
          <p className="text-stone-400">Nenhum livre pelas regras da agenda. Você ainda pode encaixar digitando o horário.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {free.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={`rounded-lg border px-2 py-1 text-xs ${t === time ? "border-stone-900 bg-stone-900 dark:border-stone-100 text-white dark:bg-stone-100 dark:text-stone-900" : "border-stone-300 dark:border-stone-700"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do cliente" name="name" defaultValue={initialName} required />
        <Field label="WhatsApp do cliente" name="phone" type="tel" inputMode="tel" placeholder="11 99999-9999" defaultValue={initialPhone?.replace(/^55/, "")} required />
      </div>
      <Field label="Observação (opcional)" name="notes" />
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Button disabled={pending || !service}>{pending ? "Salvando..." : "Agendar"}</Button>
    </form>
  );
}

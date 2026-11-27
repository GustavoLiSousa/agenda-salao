"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { formatDuration, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { dayKey, formatTime, todayIn } from "@/lib/time";
import type { Professional, Service } from "@/lib/types";
import { bookAction, type BookState } from "./actions";

type Link = {
  professional_id: string;
  service_id: string;
  price_cents: number | null;
  duration_min: number | null;
};

type Props = {
  salon: { id: string; slug: string; name: string; timezone: string };
  services: Service[];
  professionals: Professional[];
  links: Link[];
  initialService: string | null;
  initialProfessional: string | null;
  rescheduleToken: string | null;
};

const DAYS_AHEAD = 45;
const STORAGE_KEY = "agenda-salao:cliente";

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-xl font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-400 font-sans text-xs font-semibold text-brand-700 dark:text-brand-300">{n}</span>
      {children}
    </h2>
  );
}

function chip(selected: boolean) {
  return `rounded-xl border px-3.5 py-2.5 text-sm transition active:scale-[0.98] ${
    selected
      ? "border-stone-900 bg-stone-900 dark:border-stone-100 text-white dark:bg-stone-100 dark:text-stone-900"
      : "border-stone-200 bg-white hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900"
  }`;
}

export function BookingFlow(props: Props) {
  const { salon, services, professionals, links, rescheduleToken } = props;
  const tz = salon.timezone;

  const [serviceId, setServiceId] = useState<string | null>(
    services.some((s) => s.id === props.initialService) ? props.initialService : null,
  );
  const [professionalId, setProfessionalId] = useState<string | null>(props.initialProfessional);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, action, pending] = useActionState<BookState, FormData>(bookAction, {});

  const service = services.find((s) => s.id === serviceId) ?? null;
  const prosForService = useMemo(
    () => professionals.filter((p) => links.some((l) => l.professional_id === p.id && l.service_id === serviceId)),
    [professionals, links, serviceId],
  );
  const link = links.find((l) => l.professional_id === professionalId && l.service_id === serviceId);
  const price = link?.price_cents ?? service?.price_cents ?? 0;
  const duration = link?.duration_min ?? service?.duration_min ?? 0;

  // Só um profissional faz o serviço: já escolhe
  useEffect(() => {
    if (!serviceId) return;
    if (prosForService.length === 1) setProfessionalId(prosForService[0].id);
    else if (professionalId && !prosForService.some((p) => p.id === professionalId)) setProfessionalId(null);
  }, [serviceId, prosForService, professionalId]);

  // Busca horários livres
  useEffect(() => {
    setSlots(null);
    setDay(null);
    setSlot(null);
    setLoadError(null);
    if (!serviceId || !professionalId) return;
    let cancelled = false;
    createClient()
      .rpc("available_slots", {
        p_professional: professionalId,
        p_service: serviceId,
        p_from: todayIn(tz),
        p_to: todayIn(tz, DAYS_AHEAD),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError("Não foi possível carregar os horários. Tente de novo.");
        else setSlots(((data ?? []) as { starts_at: string }[]).map((r) => r.starts_at));
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, professionalId, tz]);

  // Lembra nome e telefone neste celular
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {}
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s, tz);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [slots, tz]);

  const dayLabel = (k: string) => {
    const date = new Date(`${k}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "");
    const dm = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
    if (k === todayIn(tz)) return ["Hoje", dm];
    if (k === todayIn(tz, 1)) return ["Amanhã", dm];
    return [wd, dm];
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Serviço */}
      <section className="flex flex-col gap-2">
        <StepTitle n={1}>Serviço</StepTitle>
        {rescheduleToken && service ? (
          <p className="text-sm">{service.name}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={`${chip(s.id === serviceId)} flex items-center gap-3 text-left`}
              >
                {s.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <span className="flex-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs opacity-70">{formatDuration(s.duration_min)}</span>
                </span>
                <span className="font-semibold">{formatPrice(s.price_cents)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Profissional */}
      {service && (
        <section className="flex flex-col gap-2">
          <StepTitle n={2}>Profissional</StepTitle>
          {prosForService.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhum profissional faz este serviço no momento.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {prosForService.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!!rescheduleToken}
                  onClick={() => setProfessionalId(p.id)}
                  className={`${chip(p.id === professionalId)} flex items-center gap-2 rounded-full py-1.5 pl-1.5`}
                >
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{p.name[0]}</span>
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Dia e horário */}
      {service && professionalId && (
        <section className="flex flex-col gap-3">
          <StepTitle n={3}>Dia e horário</StepTitle>
          {loadError && <Notice kind="error">{loadError}</Notice>}
          {slots === null && !loadError && <p className="text-sm text-stone-500">Carregando horários...</p>}
          {slots && byDay.size === 0 && (
            <Notice>
              Nenhum horário livre no momento. A agenda pode ainda não ter sido aberta. Tente outro profissional ou
              fale com o salão.
            </Notice>
          )}
          {byDay.size > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {[...byDay.keys()].map((k) => {
                const [top, bottom] = dayLabel(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setDay(k);
                      setSlot(null);
                    }}
                    className={`${chip(k === day)} min-w-16 shrink-0 text-center first-letter:uppercase`}
                  >
                    <span className="block text-xs">{top}</span>
                    <span className="block font-semibold">{bottom}</span>
                  </button>
                );
              })}
            </div>
          )}
          {day && (
            <div className="grid grid-cols-4 gap-2">
              {(byDay.get(day) ?? []).map((s) => (
                <button key={s} type="button" onClick={() => setSlot(s)} className={chip(s === slot)}>
                  {formatTime(s, tz)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. Confirmar */}
      {slot && service && (
        <section className="flex flex-col gap-3">
          <StepTitle n={4}>Confirmar</StepTitle>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900 dark:bg-brand-950">
            <p className="font-medium">
              {service.name} com {professionals.find((p) => p.id === professionalId)?.name}
            </p>
            <p className="first-letter:uppercase">
              {new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(
                new Date(slot),
              )}{" "}
              às {formatTime(slot, tz)}
            </p>
            <p className="text-stone-600 dark:text-stone-400">
              {formatDuration(duration)} · {formatPrice(price)}
            </p>
          </div>
          <form
            action={action}
            onSubmit={() => {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
              } catch {}
            }}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="slug" value={salon.slug} />
            <input type="hidden" name="service_id" value={service.id} />
            <input type="hidden" name="professional_id" value={professionalId ?? ""} />
            <input type="hidden" name="starts_at" value={slot} />
            {rescheduleToken ? (
              <input type="hidden" name="remarcar" value={rescheduleToken} />
            ) : (
              <>
                <Field
                  label="Seu nome"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Field
                  label="Seu WhatsApp"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="11 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </>
            )}
            {state.error && <Notice kind="error">{state.error}</Notice>}
            <Button disabled={pending} className="rounded-2xl py-4 text-base">
              {pending ? "Confirmando..." : rescheduleToken ? "Confirmar novo horário" : "Confirmar agendamento"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}

export type ClientStats = {
  client_id: string;
  salon_id: string;
  name: string | null;
  phone: string;
  birthday: string | null;
  notes: string | null;
  accepts_marketing: boolean;
  created_at: string;
  visits: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  total_spent_cents: number;
  next_appointment_at: string | null;
  no_shows: number;
  return_every_days: number | null;
  return_every_days_fixed: boolean;
  /** de onde veio o retorno: combinado com o cliente, do último serviço ou média das visitas */
  return_source: "cliente" | "servico" | "media" | null;
};

export const RETURN_SOURCE_LABEL = { cliente: "combinado", servico: "pelo serviço", media: "média das visitas" } as const;

export type LeadStatus = "agendado" | "sumido" | "vencendo" | "em_dia" | "sem_visita";

const DAY = 86_400_000;

/** Dias desde a última visita. */
export function daysSince(iso: string | null) {
  return iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : null;
}

/**
 * Situação do cliente:
 * - agendado: já tem próximo horário
 * - sumido: passou da frequência dele (ou do limite do salão) sem agendar
 * - vencendo: faltam 3 dias ou menos para a data de voltar
 */
export function leadStatus(c: ClientStats, inactiveAfterDays: number): LeadStatus {
  if (c.next_appointment_at) return "agendado";
  const since = daysSince(c.last_visit_at);
  if (since === null) return "sem_visita";
  const limit = c.return_every_days ?? inactiveAfterDays;
  if (since > limit) return "sumido";
  if (since >= limit - 3) return "vencendo";
  return "em_dia";
}

export const LEAD_LABEL: Record<LeadStatus, { label: string; cls: string }> = {
  agendado: { label: "Agendado", cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  sumido: { label: "Sumido", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  vencendo: { label: "Hora de voltar", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  em_dia: { label: "Em dia", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  sem_visita: { label: "Sem visita", cls: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
};

export function firstName(name: string | null) {
  return (name ?? "").trim().split(/\s+/)[0] || "";
}

/** Mensagens prontas para o WhatsApp. */
export function comeBackMessage(c: ClientStats, salonName: string, link: string) {
  const n = firstName(c.name);
  const since = daysSince(c.last_visit_at);
  return `Oi${n ? ` ${n}` : ""}! Sentimos sua falta aqui no ${salonName} 💈${
    since ? ` Já faz ${since} dias desde o seu último horário.` : ""
  } Que tal agendar? É rapidinho pelo link: ${link}`;
}

export function birthdayMessage(c: ClientStats, salonName: string, link: string) {
  const n = firstName(c.name);
  return `Feliz aniversário${n ? `, ${n}` : ""}! 🎉 Toda a equipe do ${salonName} te deseja um ótimo dia. Venha comemorar com a gente: ${link}`;
}

export function isBirthdayMonth(c: ClientStats, month: number) {
  return !!c.birthday && Number(c.birthday.slice(5, 7)) === month;
}

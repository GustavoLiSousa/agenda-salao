import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, GhostButton, Notice } from "@/components/ui";
import { calendarEventFor, getAppointmentByToken } from "@/lib/appointment";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/format";
import { formatLongDate, formatTime } from "@/lib/time";
import { cancelAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu agendamento", robots: { index: false } };

const STATUS: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Atendido",
  cancelled: "Desmarcado",
  no_show: "Não compareceu",
};

export default async function AgendamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ novo?: string; remarcado?: string; desmarcado?: string; erro?: string; desmarcar?: string }>;
}) {
  const { slug, token } = await params;
  const q = await searchParams;
  const a = await getAppointmentByToken(token);
  if (!a || a.salon_slug !== slug) notFound();

  const tz = a.salon_timezone;
  const when = `${formatLongDate(a.starts_at, tz)} às ${formatTime(a.starts_at, tz)}`;
  const minutes = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000);
  const active = a.status === "confirmed" && new Date(a.starts_at) > new Date();
  const canChange =
    active && new Date(a.starts_at).getTime() - Date.now() >= a.cancel_min_hours * 3_600_000;

  const msgSalon = whatsappLink(
    a.salon_whatsapp,
    `Olá! Sou ${a.client_name ?? "cliente"}. Sobre meu horário de ${a.service_name} com ${a.professional_name} em ${when}.`,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Link href={`/${slug}`} className="text-sm text-violet-600">
        ‹ {a.salon_name}
      </Link>

      {q.novo && (
        <Notice>
          Horário marcado! Guarde este link: é por ele que você vê, remarca ou desmarca o seu horário.
        </Notice>
      )}
      {q.remarcado && <Notice>Horário remarcado com sucesso!</Notice>}
      {q.desmarcado && <Notice>Horário desmarcado. Esperamos você em outra hora!</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <Card className="flex flex-col gap-1">
        <p className={`text-xs font-semibold uppercase ${a.status === "confirmed" ? "text-green-600" : "text-neutral-500"}`}>
          {STATUS[a.status] ?? a.status}
        </p>
        <h1 className="text-xl font-bold">{a.service_name}</h1>
        <p className="first-letter:uppercase">{when}</p>
        <p className="text-sm text-neutral-500">
          Com {a.professional_name} · {formatDuration(minutes)} · {formatPrice(a.price_cents)}
        </p>
        {a.salon_address && <p className="text-sm text-neutral-500">{a.salon_address}</p>}
      </Card>

      {active && (
        <div className="flex flex-col gap-2">
          <a
            href={googleCalendarUrl(calendarEventFor(a))}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-violet-600 p-3 text-center font-semibold text-white"
          >
            Salvar no Google Agenda
          </a>
          <a
            href={`/api/ics/${token}`}
            className="rounded-xl border border-violet-600 p-3 text-center font-semibold text-violet-700 dark:text-violet-300"
          >
            Salvar na agenda do celular (com lembrete)
          </a>
          {a.salon_whatsapp && (
            <a
              href={msgSalon}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-green-600 p-3 text-center font-semibold text-green-700 dark:text-green-400"
            >
              Falar com o salão no WhatsApp
            </a>
          )}
        </div>
      )}

      {canChange && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">
            Precisa mudar? Dá para remarcar ou desmarcar por aqui até {a.cancel_min_hours}h antes do horário.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${slug}/agendar?remarcar=${token}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              Remarcar
            </Link>
            {q.desmarcar ? (
              <form action={cancelAction} className="flex items-center gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="token" value={token} />
                <GhostButton className="border-red-400 text-red-600">Sim, desmarcar</GhostButton>
                <Link href={`/${slug}/agendamento/${token}`} className="text-sm text-neutral-500">
                  Não
                </Link>
              </form>
            ) : (
              <Link
                href={`/${slug}/agendamento/${token}?desmarcar=1`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-red-600 dark:border-neutral-700"
              >
                Desmarcar
              </Link>
            )}
          </div>
        </Card>
      )}
      {active && !canChange && (
        <p className="text-sm text-neutral-500">
          Para mudar este horário agora, fale com o salão pelo WhatsApp.
        </p>
      )}

      {!active && (
        <Link
          href={`/${slug}/agendar`}
          className="rounded-xl bg-violet-600 p-3 text-center font-semibold text-white"
        >
          Agendar outro horário
        </Link>
      )}
    </main>
  );
}

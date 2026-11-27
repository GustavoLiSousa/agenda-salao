import { calendarEventFor, getAppointmentByToken } from "@/lib/appointment";
import { icsFile } from "@/lib/calendar";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getAppointmentByToken(token);
  if (!a) return new Response("Agendamento não encontrado", { status: 404 });

  return new Response(icsFile({ ...calendarEventFor(a), uid: token }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamento.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

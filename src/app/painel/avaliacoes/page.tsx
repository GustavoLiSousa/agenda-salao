import { Card, GhostButton, Notice, PageHeader, inputClass } from "@/components/ui";
import { Stars, formatRating } from "@/components/stars";
import { requireSalon } from "@/lib/session";
import { replyReview, toggleHidden } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações | Agenda Salão" };

type Row = {
  id: string;
  salon_rating: number;
  professional_rating: number;
  comment: string | null;
  reply: string | null;
  hidden: boolean;
  created_at: string;
  client: { name: string | null } | null;
  professional: { name: string } | null;
};

export default async function AvaliacoesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const q = await searchParams;
  const { supabase, membership } = await requireSalon();
  const salon = membership.salon;
  const { data } = await supabase
    .from("reviews")
    .select("id, salon_rating, professional_rating, comment, reply, hidden, created_at, client:clients(name), professional:professionals(name)")
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Row[]>();
  const rows = data ?? [];
  const visible = rows.filter((r) => !r.hidden);
  const avg = visible.length ? visible.reduce((s, r) => s + r.salon_rating, 0) / visible.length : 0;
  const isOwner = membership.role === "owner";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 pb-28">
      <PageHeader
        title="Avaliações"
        subtitle={
          visible.length
            ? `Nota do salão ${formatRating(avg)} em ${visible.length} avaliaç${visible.length === 1 ? "ão" : "ões"}`
            : "Os clientes avaliam pelo link do agendamento depois de serem marcados como atendidos."
        }
        back={{ href: "/painel", label: "Início" }}
      />
      {q.erro && <Notice kind="error">{q.erro}</Notice>}
      {q.ok && <Notice kind="success">Salvo!</Notice>}
      {rows.length === 0 && (
        <Card className="text-sm text-stone-500">
          Ainda não há avaliações. Na Agenda, depois de marcar um horário como <b>Atendido</b>, toque em <b>Pedir avaliação</b>{" "}
          para mandar o link ao cliente pelo WhatsApp.
        </Card>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Card className={`flex flex-col gap-2 ${r.hidden ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.client?.name ?? "Cliente"}</span>
                <span className="text-xs text-stone-500">{new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: salon.timezone })}</span>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600 dark:text-stone-300">
                <span>Salão <Stars value={r.salon_rating} /></span>
                <span>{r.professional?.name} <Stars value={r.professional_rating} /></span>
                {r.hidden && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-stone-800">Oculta</span>}
              </p>
              {r.comment && <p className="text-sm">“{r.comment}”</p>}
              {isOwner && (
                <>
                  <form action={replyReview} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <textarea
                      name="reply"
                      defaultValue={r.reply ?? ""}
                      maxLength={600}
                      rows={2}
                      placeholder="Responder (aparece na página do salão)"
                      className={inputClass}
                    />
                    <div className="flex flex-wrap gap-2">
                      <GhostButton>{r.reply ? "Salvar resposta" : "Responder"}</GhostButton>
                    </div>
                  </form>
                  <form action={toggleHidden}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="hidden" value={r.hidden ? "0" : "1"} />
                    <button className="text-xs text-stone-500 underline-offset-4 hover:underline">
                      {r.hidden ? "Mostrar de novo na página" : "Ocultar da página (comentário ofensivo)"}
                    </button>
                  </form>
                </>
              )}
              {!isOwner && r.reply && <p className="text-sm text-stone-500">Resposta: {r.reply}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}

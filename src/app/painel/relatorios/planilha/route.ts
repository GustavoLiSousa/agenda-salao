import { loadReport } from "@/lib/reports";
import { requireSalon } from "@/lib/session";
import { dayKey, formatTime } from "@/lib/time";

const STATUS: Record<string, string> = {
  confirmed: "Agendado",
  completed: "Atendido",
  no_show: "Faltou",
  cancelled: "Desmarcado",
};

const cell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const br = (d: string) => d.split("-").reverse().join("/");

/** Planilha (CSV que abre no Excel e no Google Planilhas) com tudo do período. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { supabase, membership } = await requireSalon();
  const r = await loadReport(supabase, membership, {
    p: url.searchParams.get("p") ?? undefined,
    de: url.searchParams.get("de") ?? undefined,
    ate: url.searchParams.get("ate") ?? undefined,
  });
  const m = r.showMoney;
  const rows: (string | number)[][] = [];

  rows.push([`Relatório ${r.salon.name}`, `${br(r.period.from)} a ${br(r.period.to)}`]);
  rows.push([]);
  rows.push(["Resumo"]);
  if (m) rows.push(["Faturamento (R$)", reais(r.summary.total)]);
  if (m) rows.push(["Serviços pagos na hora (R$)", reais(r.summary.servicesCents)]);
  if (m && !r.onlyMine) rows.push(["Pacotes vendidos (R$)", reais(r.summary.packagesCents)]);
  rows.push(["Atendimentos", r.summary.attended]);
  if (m) rows.push(["Ticket médio (R$)", reais(r.summary.ticket)]);
  rows.push(["Faltas", r.losses.noShows]);
  rows.push(["Desmarcados", r.losses.cancelled]);
  rows.push([]);

  rows.push(["Por profissional"]);
  rows.push(["Profissional", "Atendimentos", "De pacote", ...(m ? ["Valor (R$)", "Comissão %", "Comissão (R$)"] : [])]);
  for (const p of r.byPro)
    rows.push([
      p.name,
      p.count,
      p.byPackage,
      ...(m ? [reais(p.cents), p.pct ?? "", p.commissionCents != null ? reais(p.commissionCents) : ""] : []),
    ]);
  rows.push([]);

  rows.push(["Atendimentos"]);
  rows.push([
    "Data",
    "Hora",
    "Profissional",
    "Cliente",
    "Telefone",
    "Serviço",
    "Situação",
    "Pago com pacote",
    ...(m ? ["Valor (R$)"] : []),
  ]);
  for (const a of r.appts)
    rows.push([
      br(a.day),
      formatTime(a.starts_at, r.tz),
      a.professional?.name ?? "",
      a.client?.name ?? "",
      a.client?.phone ?? "",
      a.service?.name ?? "",
      a.done && a.status === "confirmed" ? "Atendido" : (STATUS[a.status] ?? a.status),
      a.byPackage ? "Sim" : "",
      ...(m ? [reais(a.price_cents)] : []),
    ]);

  if (!r.onlyMine && r.packagesSold.length) {
    rows.push([]);
    rows.push(["Pacotes vendidos"]);
    rows.push(["Data", "Cliente", "Pacote", ...(m ? ["Valor (R$)"] : [])]);
    for (const p of r.packagesSold)
      rows.push([
        br(dayKey(p.purchased_at, r.tz)),
        p.client?.name ?? p.client?.phone ?? "",
        p.name,
        ...(m ? [reais(p.price_cents)] : []),
      ]);
  }

  const csv = "﻿" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${r.period.from}-a-${r.period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

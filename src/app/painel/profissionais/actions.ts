"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIntOrNull } from "@/lib/parse";
import { requireSalon } from "@/lib/session";
import { zonedToDate } from "@/lib/time";

function back(id: string | null, params: string): never {
  redirect(id ? `/painel/profissionais/${id}?${params}` : `/painel/profissionais?${params}`);
}
function fail(id: string | null, message: string): never {
  back(id, `erro=${encodeURIComponent(message)}`);
}

export async function createProfessional(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail(null, "Informe o nome do profissional.");

  const { data, error } = await supabase
    .from("professionals")
    .insert({ salon_id: membership.salon.id, name })
    .select("id")
    .single();
  if (error || !data) fail(null, error?.message ?? "Erro ao salvar.");

  // Começa fazendo todos os serviços ativos e com horário padrão ter-sáb 9h-12h / 13h-19h
  const { data: services } = await supabase
    .from("services")
    .select("id")
    .eq("salon_id", membership.salon.id)
    .eq("active", true);
  if (services?.length) {
    await supabase
      .from("professional_services")
      .insert(services.map((s) => ({ professional_id: data.id, service_id: s.id })));
  }
  const hours = [2, 3, 4, 5, 6].flatMap((weekday) => [
    { professional_id: data.id, weekday, start_time: "09:00", end_time: "12:00" },
    { professional_id: data.id, weekday, start_time: "13:00", end_time: "19:00" },
  ]);
  await supabase.from("working_hours").insert(hours);

  revalidatePath("/painel/profissionais");
  redirect(`/painel/profissionais/${data.id}?novo=1`);
}

export async function saveProfessional(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail(id, "Informe o nome.");
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "") || null;

  const release_mode = formData.get("release_mode") === "weekly" ? "weekly" : "rolling";
  const release_days_ahead = parseIntOrNull(formData.get("release_days_ahead")) ?? 30;
  const release_weekday = parseIntOrNull(formData.get("release_weekday"));
  const release_time = String(formData.get("release_time") ?? "") || null;
  const release_weeks_ahead = parseIntOrNull(formData.get("release_weeks_ahead")) ?? 1;
  const slot_step_min = parseIntOrNull(formData.get("slot_step_min")) ?? 15;

  if (release_mode === "weekly" && (release_weekday === null || !release_time))
    fail(id, "Escolha o dia e a hora em que a agenda abre.");

  const { error } = await supabase
    .from("professionals")
    .update({
      name,
      phone,
      bio: String(formData.get("bio") ?? "").trim() || null,
      active: formData.get("active") === "on",
      slot_step_min,
      release_mode,
      release_days_ahead,
      release_weekday: release_mode === "weekly" ? release_weekday : null,
      release_time: release_mode === "weekly" ? release_time : null,
      release_weeks_ahead,
    })
    .eq("id", id);
  if (error) fail(id, error.message);

  // Serviços que este profissional faz
  const selected = formData.getAll("services").map(String);
  await supabase.from("professional_services").delete().eq("professional_id", id);
  if (selected.length) {
    const { error: e2 } = await supabase
      .from("professional_services")
      .insert(selected.map((service_id) => ({ professional_id: id, service_id })));
    if (e2) fail(id, e2.message);
  }

  revalidatePath(`/painel/profissionais/${id}`);
  back(id, "ok=dados");
}

export async function saveWorkingHours(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  const rows: { professional_id: string; weekday: number; start_time: string; end_time: string }[] = [];

  for (let d = 0; d < 7; d++) {
    if (formData.get(`on_${d}`) !== "on") continue;
    for (const part of [1, 2]) {
      const start = String(formData.get(`start${part}_${d}`) ?? "");
      const end = String(formData.get(`end${part}_${d}`) ?? "");
      if (!start && !end) continue;
      if (!start || !end || end <= start)
        fail(id, "Confira os horários: o fim precisa ser depois do início.");
      rows.push({ professional_id: id, weekday: d, start_time: start, end_time: end });
    }
  }

  // intervalos do mesmo dia não podem se sobrepor
  for (let d = 0; d < 7; d++) {
    const day = rows.filter((r) => r.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < day.length; i++) {
      if (day[i].start_time < day[i - 1].end_time)
        fail(id, "Os dois períodos de um mesmo dia não podem se sobrepor.");
    }
  }

  await supabase.from("working_hours").delete().eq("professional_id", id);
  if (rows.length) {
    const { error } = await supabase.from("working_hours").insert(rows);
    if (error) fail(id, error.message);
  }
  revalidatePath(`/painel/profissionais/${id}`);
  back(id, "ok=horarios");
}

export async function addTimeBlock(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const id = String(formData.get("id"));
  const tz = membership.salon.timezone;
  const startDay = String(formData.get("start_day") ?? "");
  const endDay = String(formData.get("end_day") ?? "") || startDay;
  const allDay = formData.get("all_day") === "on";
  const startTime = allDay ? "00:00" : String(formData.get("start_time") ?? "");
  const endTime = allDay ? "23:59" : String(formData.get("end_time") ?? "");

  if (!startDay || !startTime || !endTime) fail(id, "Preencha data e horário do bloqueio.");
  const starts = zonedToDate(startDay, startTime, tz);
  const ends = zonedToDate(endDay, endTime, tz);
  if (ends <= starts) fail(id, "O fim do bloqueio precisa ser depois do início.");

  const { error } = await supabase.from("time_blocks").insert({
    professional_id: id,
    starts_at: starts.toISOString(),
    ends_at: (allDay ? new Date(ends.getTime() + 60_000) : ends).toISOString(),
    reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (error) fail(id, error.message);
  revalidatePath(`/painel/profissionais/${id}`);
  back(id, "ok=bloqueio");
}

export async function removeTimeBlock(formData: FormData) {
  const { supabase } = await requireSalon();
  const id = String(formData.get("id"));
  await supabase.from("time_blocks").delete().eq("id", String(formData.get("block_id")));
  revalidatePath(`/painel/profissionais/${id}`);
  back(id, "ok=bloqueio");
}

/** Exclui o profissional. Se ele já tem atendimentos no histórico, arquiva (some de tudo, mas o histórico fica). */
export async function deleteProfessional(formData: FormData) {
  const { supabase, membership } = await requireSalon();
  const id = String(formData.get("id"));
  if (membership.role !== "owner") fail(id, "Só o dono do salão pode excluir profissionais.");

  const { count: future } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", id)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString());
  if (future)
    fail(id, `Ele ainda tem ${future} horário(s) marcado(s). Desmarque ou passe para outro profissional antes de excluir.`);

  const { count: history } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", id);

  const { error } = history
    ? await supabase
        .from("professionals")
        .update({ active: false, archived_at: new Date().toISOString() })
        .eq("id", id)
    : await supabase.from("professionals").delete().eq("id", id);
  if (error) fail(id, error.message);

  revalidatePath("/painel/profissionais");
  redirect("/painel/profissionais?ok=excluido");
}

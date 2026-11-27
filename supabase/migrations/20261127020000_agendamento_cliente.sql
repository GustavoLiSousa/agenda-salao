-- =====================================================================
-- Etapa 4: o cliente agenda pelo link do salão informando nome e telefone.
-- Cada agendamento tem um link pessoal secreto (manage_token) para ver,
-- desmarcar ou remarcar.
-- =====================================================================

alter table public.appointments
  add column manage_token uuid not null default gen_random_uuid();
create unique index appointments_manage_token on public.appointments (manage_token);

-- ---------------------------------------------------------------------
-- Horários livres de um profissional para um serviço, num intervalo de dias
-- (datas no fuso do salão). Devolve só o início de cada horário.
-- ---------------------------------------------------------------------
create or replace function public.available_slots(
  p_professional uuid,
  p_service uuid,
  p_from date,
  p_to date
) returns table (starts_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  prof public.professionals;
  tz text;
  v_dur int;
  v_open_until timestamptz;
begin
  select * into prof from public.professionals where id = p_professional and active;
  if not found then return; end if;

  select coalesce(ps.duration_min, s.duration_min) into v_dur
    from public.professional_services ps
    join public.services s on s.id = ps.service_id and s.active
   where ps.professional_id = prof.id and ps.service_id = p_service;
  if v_dur is null then return; end if;

  select timezone into tz from public.salons where id = prof.salon_id;
  v_open_until := public.booking_open_until(prof.id);
  if p_to - p_from > 62 then p_to := p_from + 62; end if;

  return query
  with days as (
    select d::date as day from generate_series(p_from, p_to, interval '1 day') d
  ),
  candidates as (
    select (gs at time zone tz) as s
      from days
      join public.working_hours w
        on w.professional_id = prof.id
       and w.weekday = extract(dow from days.day)::int
      cross join lateral generate_series(
        days.day + w.start_time,
        days.day + w.end_time - make_interval(mins => v_dur),
        make_interval(mins => prof.slot_step_min)
      ) gs
  )
  select c.s
    from candidates c
   where c.s > now()
     and c.s + make_interval(mins => v_dur) <= v_open_until
     and not exists (
       select 1 from public.appointments a
        where a.professional_id = prof.id and a.status = 'confirmed'
          and a.starts_at < c.s + make_interval(mins => v_dur) and a.ends_at > c.s
     )
     and not exists (
       select 1 from public.time_blocks b
        where b.professional_id = prof.id
          and b.starts_at < c.s + make_interval(mins => v_dur) and b.ends_at > c.s
     )
   order by c.s;
end $$;

-- ---------------------------------------------------------------------
-- Validação + gravação comum a todos os jeitos de agendar
-- ---------------------------------------------------------------------
create or replace function public._insert_appointment(
  p_professional uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_client uuid,
  p_source text
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  prof public.professionals;
  svc public.services;
  ps public.professional_services;
  tz text;
  v_end timestamptz;
  local_start timestamp;
  local_end timestamp;
  v_appt public.appointments;
begin
  select * into prof from public.professionals where id = p_professional and active;
  if not found then raise exception 'Profissional não encontrado'; end if;
  select * into svc from public.services where id = p_service and salon_id = prof.salon_id and active;
  if not found then raise exception 'Serviço não encontrado'; end if;
  select * into ps from public.professional_services
   where professional_id = prof.id and service_id = svc.id;
  if not found then raise exception 'Este profissional não faz este serviço'; end if;

  v_end := p_starts_at + make_interval(mins => coalesce(ps.duration_min, svc.duration_min));

  if p_starts_at < now() then raise exception 'Este horário já passou'; end if;
  if v_end > public.booking_open_until(prof.id) then
    raise exception 'A agenda para esta data ainda não foi aberta';
  end if;

  select timezone into tz from public.salons where id = prof.salon_id;
  local_start := p_starts_at at time zone tz;
  local_end   := v_end at time zone tz;
  if local_start::date <> local_end::date or not exists (
    select 1 from public.working_hours w
     where w.professional_id = prof.id
       and w.weekday = extract(dow from local_start)::int
       and w.start_time <= local_start::time
       and w.end_time   >= local_end::time
  ) then
    raise exception 'Fora do horário de atendimento';
  end if;

  if exists (select 1 from public.time_blocks b where b.professional_id = prof.id
               and b.starts_at < v_end and b.ends_at > p_starts_at) then
    raise exception 'Horário indisponível';
  end if;

  begin
    insert into public.appointments
      (salon_id, professional_id, client_id, service_id, starts_at, ends_at, price_cents, source)
    values
      (prof.salon_id, prof.id, p_client, svc.id, p_starts_at, v_end,
       coalesce(ps.price_cents, svc.price_cents), p_source)
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end;
  return v_appt;
end $$;
revoke execute on function public._insert_appointment(uuid, uuid, timestamptz, uuid, text) from public, anon, authenticated;

-- Cliente com login (mantido para uso futuro) passa a usar a validação comum
create or replace function public.book_appointment(
  p_professional uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_client_name text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid;
  v_phone text;
  v_client public.clients;
begin
  if auth.uid() is null then raise exception 'Entre com seu telefone para agendar'; end if;
  select salon_id into v_salon from public.professionals where id = p_professional;
  if v_salon is null then raise exception 'Profissional não encontrado'; end if;

  select regexp_replace(coalesce(phone, ''), '\D', '', 'g') into v_phone
    from auth.users where id = auth.uid();
  if v_phone is null or v_phone = '' then raise exception 'Telefone não encontrado no login'; end if;

  insert into public.clients (salon_id, user_id, phone, name)
  values (v_salon, auth.uid(), v_phone, nullif(trim(p_client_name), ''))
  on conflict (salon_id, phone) do update
     set user_id = excluded.user_id,
         name = coalesce(public.clients.name, excluded.name)
  returning * into v_client;

  return public._insert_appointment(p_professional, p_service, p_starts_at, v_client.id, 'client');
end $$;
revoke execute on function public.book_appointment(uuid, uuid, timestamptz, text) from public, anon;

-- ---------------------------------------------------------------------
-- Agendar pelo link, sem login: nome + telefone
-- ---------------------------------------------------------------------
create or replace function public.book_as_guest(
  p_professional uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text
) returns uuid   -- manage_token
language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_client public.clients;
  v_appt public.appointments;
begin
  if v_name is null or char_length(v_name) < 2 then raise exception 'Informe seu nome'; end if;
  if char_length(v_name) > 80 then raise exception 'Nome muito longo'; end if;
  if v_phone !~ '^55' then v_phone := '55' || v_phone; end if;
  if v_phone !~ '^55[0-9]{10,11}$' then
    raise exception 'Telefone inválido. Use DDD + número, ex.: 11 99999-9999';
  end if;

  select salon_id into v_salon from public.professionals where id = p_professional;
  if v_salon is null then raise exception 'Profissional não encontrado'; end if;

  insert into public.clients (salon_id, phone, name)
  values (v_salon, v_phone, v_name)
  on conflict (salon_id, phone) do update
     set name = coalesce(public.clients.name, excluded.name)
  returning * into v_client;

  -- trava simples contra abuso: no máximo 3 horários futuros por telefone
  if (select count(*) from public.appointments
       where client_id = v_client.id and status = 'confirmed' and starts_at > now()) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Fale com o salão pelo WhatsApp.';
  end if;

  v_appt := public._insert_appointment(p_professional, p_service, p_starts_at, v_client.id, 'client');
  return v_appt.manage_token;
end $$;

-- ---------------------------------------------------------------------
-- Link pessoal: ver, desmarcar e remarcar
-- ---------------------------------------------------------------------
create or replace function public.appointment_by_token(p_token uuid)
returns table (
  status public.appointment_status,
  starts_at timestamptz,
  ends_at timestamptz,
  price_cents int,
  client_name text,
  service_id uuid,
  service_name text,
  professional_id uuid,
  professional_name text,
  salon_name text,
  salon_slug text,
  salon_whatsapp text,
  salon_address text,
  salon_timezone text,
  cancel_min_hours int
)
language sql stable security definer set search_path = public as $$
  select a.status, a.starts_at, a.ends_at, a.price_cents, c.name,
         s.id, s.name, p.id, p.name,
         sa.name, sa.slug, sa.whatsapp, sa.address, sa.timezone, sa.cancel_min_hours
    from public.appointments a
    join public.clients c on c.id = a.client_id
    join public.services s on s.id = a.service_id
    join public.professionals p on p.id = a.professional_id
    join public.salons sa on sa.id = a.salon_id
   where a.manage_token = p_token;
$$;

create or replace function public.cancel_by_token(p_token uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  min_hours int;
begin
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status <> 'confirmed' then raise exception 'Este agendamento não está mais ativo'; end if;
  select cancel_min_hours into min_hours from public.salons where id = a.salon_id;
  if a.starts_at - now() < make_interval(hours => min_hours) then
    raise exception 'O prazo para desmarcar pelo link acabou. Fale com o salão pelo WhatsApp.';
  end if;
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = coalesce(p_reason, 'Desmarcado pelo cliente')
   where id = a.id;
end $$;

create or replace function public.reschedule_by_token(p_token uuid, p_new_start timestamptz)
returns uuid  -- novo manage_token
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  min_hours int;
  v_new public.appointments;
begin
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status <> 'confirmed' then raise exception 'Este agendamento não está mais ativo'; end if;
  select cancel_min_hours into min_hours from public.salons where id = a.salon_id;
  if a.starts_at - now() < make_interval(hours => min_hours) then
    raise exception 'O prazo para remarcar pelo link acabou. Fale com o salão pelo WhatsApp.';
  end if;

  -- libera o horário antigo e marca o novo na mesma transação
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Remarcado pelo cliente'
   where id = a.id;
  v_new := public._insert_appointment(a.professional_id, a.service_id, p_new_start, a.client_id, 'client');
  return v_new.manage_token;
end $$;

grant execute on function public.available_slots(uuid, uuid, date, date) to anon, authenticated;
grant execute on function public.book_as_guest(uuid, uuid, timestamptz, text, text) to anon, authenticated;
grant execute on function public.appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_by_token(uuid, text) to anon, authenticated;
grant execute on function public.reschedule_by_token(uuid, timestamptz) to anon, authenticated;

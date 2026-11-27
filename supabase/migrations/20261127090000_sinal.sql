-- =====================================================================
-- Etapa: sinal (depósito) pelo Mercado Pago
--
-- Em períodos escolhidos pelo dono (ex.: 20/12 a 31/12), o horário só
-- fica garantido depois que o cliente paga o sinal. Enquanto não paga,
-- o horário fica reservado por 15 minutos; depois disso é liberado.
-- Desmarcando com a antecedência combinada, o sinal é devolvido.
--
-- Só adiciona colunas, tabelas e funções; as funções de agendamento
-- existentes são reescritas com a mesma assinatura.
-- =====================================================================

create schema if not exists private;

-- Segredo que o servidor do app usa para chamar as funções server_*
create table if not exists private.app_secrets (
  name  text primary key,
  value text not null
);

-- Conta do Mercado Pago de cada salão (tokens ficam fora da API pública)
create table if not exists private.salon_mp_accounts (
  salon_id       uuid primary key references public.salons(id) on delete cascade,
  mp_user_id     text,
  access_token   text,
  refresh_token  text,
  public_key     text,
  expires_at     timestamptz,
  connected_at   timestamptz not null default now()
);

alter table public.salons
  add column if not exists payments_enabled     boolean not null default false,
  add column if not exists deposit_refund_hours int not null default 48
    check (deposit_refund_hours between 0 and 720);

alter table public.appointments
  add column if not exists deposit_cents   int check (deposit_cents >= 0),
  add column if not exists payment_status  text check (payment_status in ('pending', 'paid', 'expired', 'refunded', 'kept')),
  add column if not exists hold_expires_at timestamptz;
create index if not exists appointments_pending_hold_idx
  on public.appointments (hold_expires_at) where payment_status = 'pending';

-- Períodos em que o salão exige sinal
create table public.deposit_rules (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  kind        text not null check (kind in ('fixed', 'percent')),
  value       int  not null check (value > 0),   -- centavos (fixed) ou % (percent)
  label       text check (char_length(label) <= 60),
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (kind <> 'percent' or value <= 100)
);
create index on public.deposit_rules (salon_id, starts_on);
alter table public.deposit_rules enable row level security;
create policy "períodos com sinal são públicos" on public.deposit_rules
  for select using (true);
create policy "dono gerencia períodos com sinal" on public.deposit_rules
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

-- Pagamentos recebidos
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references public.salons(id) on delete cascade,
  appointment_id    uuid references public.appointments(id) on delete set null,
  kind              text not null default 'deposit' check (kind in ('deposit', 'package', 'full')),
  amount_cents      int  not null check (amount_cents >= 0),
  status            text not null,               -- status do Mercado Pago (approved, pending, refunded...)
  mp_payment_id     text unique,
  method            text,
  refunded_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.payments (salon_id, created_at desc);
create index on public.payments (appointment_id);
alter table public.payments enable row level security;
create policy "equipe vê pagamentos" on public.payments
  for select using (public.is_salon_member(salon_id));

-- ---------------------------------------------------------------------
-- Sinal exigido para um salão num horário (null = não precisa)
-- ---------------------------------------------------------------------
create or replace function public.deposit_required(p_salon uuid, p_starts_at timestamptz, p_price_cents int)
returns int
language sql stable security definer set search_path = public as $$
  select case
           when not s.payments_enabled then null
           else (
             select max(case when r.kind = 'fixed' then least(r.value, greatest(p_price_cents, r.value))
                             else greatest(100, round(p_price_cents * r.value / 100.0)::int) end)
               from public.deposit_rules r
              where r.salon_id = s.id
                and (p_starts_at at time zone s.timezone)::date between r.starts_on and r.ends_on
           )
         end
    from public.salons s where s.id = p_salon;
$$;

-- Libera reservas cujo sinal não foi pago a tempo
create or replace function public.release_expired_holds()
returns int
language sql security definer set search_path = public as $$
  with x as (
    update public.appointments
       set status = 'cancelled', cancelled_at = now(),
           cancel_reason = 'Sinal não foi pago a tempo', payment_status = 'expired'
     where payment_status = 'pending' and status = 'confirmed' and hold_expires_at < now()
    returning 1
  )
  select count(*)::int from x;
$$;

-- ---------------------------------------------------------------------
-- Funções de agendamento: reserva com sinal (mesma assinatura de antes)
-- ---------------------------------------------------------------------
create or replace function public._insert_appointment(
  p_professional uuid, p_service uuid, p_starts_at timestamptz, p_client uuid, p_source text
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

  -- reservas sem sinal pago que venceram não seguram mais o horário
  update public.appointments
     set status = 'cancelled', cancelled_at = now(),
         cancel_reason = 'Sinal não foi pago a tempo', payment_status = 'expired'
   where professional_id = prof.id and status = 'confirmed'
     and payment_status = 'pending' and hold_expires_at < now()
     and starts_at < v_end and ends_at > p_starts_at;

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

create or replace function public.available_slots(p_professional uuid, p_service uuid, p_from date, p_to date)
returns table (starts_at timestamptz)
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
          and not (a.payment_status is not distinct from 'pending' and a.hold_expires_at < now())
          and a.starts_at < c.s + make_interval(mins => v_dur) and a.ends_at > c.s
     )
     and not exists (
       select 1 from public.time_blocks b
        where b.professional_id = prof.id
          and b.starts_at < c.s + make_interval(mins => v_dur) and b.ends_at > c.s
     )
   order by c.s;
end $$;

create or replace function public.busy_slots(p_professional uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at from public.appointments a
   where a.professional_id = p_professional and a.status = 'confirmed'
     and not (a.payment_status is not distinct from 'pending' and a.hold_expires_at < now())
     and a.starts_at < p_to and a.ends_at > p_from
  union all
  select b.starts_at, b.ends_at from public.time_blocks b
   where b.professional_id = p_professional
     and b.starts_at < p_to and b.ends_at > p_from;
$$;

create or replace function public.book_as_guest(
  p_professional uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_client public.clients;
  v_appt public.appointments;
  v_deposit int;
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
       where client_id = v_client.id and status = 'confirmed' and starts_at > now()
         and not (payment_status is not distinct from 'pending' and hold_expires_at < now())) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Fale com o salão pelo WhatsApp.';
  end if;

  v_appt := public._insert_appointment(p_professional, p_service, p_starts_at, v_client.id, 'client');

  -- período com sinal: o horário fica reservado por 15 minutos até o pagamento
  v_deposit := public.deposit_required(v_salon, v_appt.starts_at, v_appt.price_cents);
  if v_deposit is not null and v_deposit > 0 then
    update public.appointments
       set deposit_cents = v_deposit, payment_status = 'pending', hold_expires_at = now() + interval '15 minutes'
     where id = v_appt.id;
  end if;

  return v_appt.manage_token;
end $$;

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
  -- reserva ainda sem sinal pago pode ser desistida a qualquer momento
  if a.payment_status is distinct from 'pending' and a.starts_at - now() < make_interval(hours => min_hours) then
    raise exception 'O prazo para desmarcar pelo link acabou. Fale com o salão pelo WhatsApp.';
  end if;
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = coalesce(p_reason, 'Desmarcado pelo cliente'),
         payment_status = case when a.payment_status = 'pending' then 'expired' else a.payment_status end
   where id = a.id;
end $$;

create or replace function public.reschedule_by_token(p_token uuid, p_new_start timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  min_hours int;
  v_new public.appointments;
begin
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status <> 'confirmed' then raise exception 'Este agendamento não está mais ativo'; end if;
  if a.payment_status = 'pending' then
    raise exception 'Pague o sinal antes de remarcar, ou desista e agende de novo.';
  end if;
  select cancel_min_hours into min_hours from public.salons where id = a.salon_id;
  if a.starts_at - now() < make_interval(hours => min_hours) then
    raise exception 'O prazo para remarcar pelo link acabou. Fale com o salão pelo WhatsApp.';
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Remarcado pelo cliente'
   where id = a.id;
  v_new := public._insert_appointment(a.professional_id, a.service_id, p_new_start, a.client_id, 'client');

  -- o sinal já pago vai junto para o novo horário
  if a.payment_status = 'paid' then
    update public.appointments set deposit_cents = a.deposit_cents, payment_status = 'paid'
     where id = v_new.id;
    update public.appointments set payment_status = null where id = a.id;
    update public.payments set appointment_id = v_new.id, updated_at = now() where appointment_id = a.id;
  end if;
  return v_new.manage_token;
end $$;

-- Situação do sinal pelo link pessoal
create or replace function public.deposit_by_token(p_token uuid)
returns table (
  appointment_id uuid,
  salon_id uuid,
  deposit_cents int,
  payment_status text,
  hold_expires_at timestamptz,
  refund_hours int,
  starts_at timestamptz,
  status public.appointment_status
)
language sql stable security definer set search_path = public as $$
  select a.id, a.salon_id, a.deposit_cents, a.payment_status, a.hold_expires_at, s.deposit_refund_hours, a.starts_at, a.status
    from public.appointments a join public.salons s on s.id = a.salon_id
   where a.manage_token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Funções do servidor (exigem o segredo do app)
-- ---------------------------------------------------------------------
create or replace function private.check_secret(p_secret text)
returns void language plpgsql security definer set search_path = private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'server' and value = p_secret) then
    raise exception 'forbidden';
  end if;
end $$;

create or replace function public.server_mp_account(p_secret text, p_salon uuid)
returns table (access_token text, refresh_token text, public_key text, expires_at timestamptz, mp_user_id text)
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.check_secret(p_secret);
  return query select m.access_token, m.refresh_token, m.public_key, m.expires_at, m.mp_user_id
                 from private.salon_mp_accounts m where m.salon_id = p_salon and m.access_token is not null;
end $$;

create or replace function public.server_save_mp_account(
  p_secret text, p_salon uuid, p_mp_user_id text, p_access_token text, p_refresh_token text,
  p_public_key text, p_expires_at timestamptz
) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.check_secret(p_secret);
  insert into private.salon_mp_accounts (salon_id, mp_user_id, access_token, refresh_token, public_key, expires_at, connected_at)
  values (p_salon, p_mp_user_id, p_access_token, p_refresh_token, p_public_key, p_expires_at, now())
  on conflict (salon_id) do update
     set mp_user_id = excluded.mp_user_id, access_token = excluded.access_token,
         refresh_token = excluded.refresh_token, public_key = excluded.public_key,
         expires_at = excluded.expires_at, connected_at = now();
  update public.salons set payments_enabled = true where id = p_salon;
end $$;

-- Desconectar (dono logado)
create or replace function public.disconnect_mercado_pago(p_salon uuid)
returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_salon_owner(p_salon) then raise exception 'Sem permissão'; end if;
  update private.salon_mp_accounts set access_token = null, refresh_token = null where salon_id = p_salon;
  update public.salons set payments_enabled = false where id = p_salon;
end $$;

-- Pagamento recebido (webhook ou volta do checkout). Retorna o que aconteceu.
create or replace function public.server_record_payment(
  p_secret text, p_appointment uuid, p_mp_payment_id text, p_status text, p_amount_cents int, p_method text
) returns text
language plpgsql security definer set search_path = public, private as $$
declare
  a public.appointments;
begin
  perform private.check_secret(p_secret);
  select * into a from public.appointments where id = p_appointment for update;
  if not found then return 'not_found'; end if;

  insert into public.payments (salon_id, appointment_id, kind, amount_cents, status, mp_payment_id, method)
  values (a.salon_id, a.id, 'deposit', p_amount_cents, p_status, p_mp_payment_id, p_method)
  on conflict (mp_payment_id) do update
     set status = excluded.status, amount_cents = excluded.amount_cents, method = excluded.method, updated_at = now();

  if p_status <> 'approved' then return 'ignored'; end if;
  if a.payment_status = 'paid' then return 'already_paid'; end if;

  if a.status = 'confirmed' and a.payment_status = 'pending' then
    update public.appointments set payment_status = 'paid', hold_expires_at = null where id = a.id;
    return 'paid';
  end if;

  -- pagou depois que a reserva venceu: tenta segurar o horário de novo
  if a.status = 'cancelled' and a.payment_status = 'expired' and a.starts_at > now() then
    begin
      update public.appointments
         set status = 'confirmed', cancelled_at = null, cancel_reason = null,
             payment_status = 'paid', hold_expires_at = null
       where id = a.id;
      return 'paid';
    exception when exclusion_violation then
      return 'late_refund';
    end;
  end if;
  return 'late_refund';
end $$;

-- Dados para devolver o sinal (cliente desmarcou)
create or replace function public.server_refund_candidate(p_secret text, p_token uuid)
returns table (mp_payment_id text, salon_id uuid, amount_cents int, eligible boolean)
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.check_secret(p_secret);
  return query
  select p.mp_payment_id, a.salon_id, p.amount_cents,
         (a.cancelled_at is not null and a.starts_at - a.cancelled_at >= make_interval(hours => s.deposit_refund_hours))
    from public.appointments a
    join public.salons s on s.id = a.salon_id
    join public.payments p on p.appointment_id = a.id and p.status = 'approved' and p.refunded_at is null
   where a.manage_token = p_token and a.status = 'cancelled' and a.payment_status = 'paid';
end $$;

create or replace function public.server_mark_refund(p_secret text, p_mp_payment_id text, p_refunded boolean)
returns void
language plpgsql security definer set search_path = public, private as $$
declare
  v_appt uuid;
begin
  perform private.check_secret(p_secret);
  if p_refunded then
    update public.payments set status = 'refunded', refunded_at = now(), updated_at = now()
     where mp_payment_id = p_mp_payment_id returning appointment_id into v_appt;
  else
    select appointment_id into v_appt from public.payments where mp_payment_id = p_mp_payment_id;
  end if;
  update public.appointments set payment_status = case when p_refunded then 'refunded' else 'kept' end
   where id = v_appt and status = 'cancelled';
end $$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on schema private from public, anon, authenticated;
revoke execute on function private.check_secret(text) from public, anon, authenticated;

grant execute on function public.deposit_required(uuid, timestamptz, int) to anon, authenticated;
grant execute on function public.release_expired_holds() to anon, authenticated;
grant execute on function public.deposit_by_token(uuid) to anon, authenticated;
grant execute on function public.server_mp_account(text, uuid) to anon, authenticated;
grant execute on function public.server_save_mp_account(text, uuid, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.server_record_payment(text, uuid, text, text, int, text) to anon, authenticated;
grant execute on function public.server_refund_candidate(text, uuid) to anon, authenticated;
grant execute on function public.server_mark_refund(text, text, boolean) to anon, authenticated;
revoke execute on function public.disconnect_mercado_pago(uuid) from public, anon;
grant execute on function public.disconnect_mercado_pago(uuid) to authenticated;

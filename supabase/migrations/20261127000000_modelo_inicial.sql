-- =====================================================================
-- Agenda Salão: modelo de dados inicial
--
-- Multi-salão: cada salão tem um "slug" (ex.: barbearia-do-ze) usado no link
-- público. Perfis:
--   * dono (owner)          -> gestão completa do salão
--   * profissional          -> vê e gerencia a própria agenda
--   * cliente               -> entra só com o telefone e agenda horários
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.member_role as enum ('owner', 'professional');

create type public.appointment_status as enum (
  'confirmed',   -- agendado e confirmado
  'completed',   -- atendido
  'cancelled',   -- desmarcado
  'no_show'      -- cliente faltou
);

-- Como a agenda de um profissional é liberada para os clientes
create type public.booking_release as enum (
  'rolling',     -- sempre aberta para os próximos N dias
  'weekly'       -- abre num dia/hora fixos (ex.: toda segunda 00:00)
);

-- ---------------------------------------------------------------------
-- Salões
-- ---------------------------------------------------------------------
create table public.salons (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique
                        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                  text not null,
  whatsapp              text,                -- só dígitos, com DDI: 5511999999999
  address               text,
  instagram             text,
  logo_url              text,
  timezone              text not null default 'America/Sao_Paulo',
  -- até quantas horas antes o cliente pode desmarcar/remarcar sozinho
  cancel_min_hours      int  not null default 2 check (cancel_min_hours >= 0),
  -- dias sem agendar para o cliente virar "sumido" (lead para chamar de volta)
  inactive_after_days   int  not null default 30 check (inactive_after_days > 0),
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profissionais
-- ---------------------------------------------------------------------
create table public.professionals (
  id                    uuid primary key default gen_random_uuid(),
  salon_id              uuid not null references public.salons(id) on delete cascade,
  user_id               uuid references auth.users(id) on delete set null,
  name                  text not null,
  phone                 text,
  photo_url             text,
  bio                   text,
  active                boolean not null default true,
  -- intervalo entre horários oferecidos (minutos)
  slot_step_min         int not null default 15 check (slot_step_min between 5 and 120),
  -- abertura da agenda
  release_mode          public.booking_release not null default 'rolling',
  release_days_ahead    int not null default 30 check (release_days_ahead between 1 and 365),
  release_weekday       smallint check (release_weekday between 0 and 6), -- 0 = domingo
  release_time          time,
  release_weeks_ahead   smallint not null default 1 check (release_weeks_ahead between 1 and 8),
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  constraint weekly_release_needs_day check (
    release_mode <> 'weekly' or (release_weekday is not null and release_time is not null)
  )
);
create index on public.professionals (salon_id);
create unique index professionals_salon_user on public.professionals (salon_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------
-- Equipe com login (dono e profissionais)
-- ---------------------------------------------------------------------
create table public.salon_members (
  salon_id              uuid not null references public.salons(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  role                  public.member_role not null,
  professional_id       uuid references public.professionals(id) on delete set null,
  created_at            timestamptz not null default now(),
  primary key (salon_id, user_id)
);

-- ---------------------------------------------------------------------
-- Serviços (corte, corte + cavanhaque, progressiva, manicure...)
-- ---------------------------------------------------------------------
create table public.services (
  id                    uuid primary key default gen_random_uuid(),
  salon_id              uuid not null references public.salons(id) on delete cascade,
  name                  text not null,
  description           text,
  category              text,                -- ex.: Cabelo, Barba, Unhas, Sobrancelha
  price_cents           int  not null default 0 check (price_cents >= 0),
  duration_min          int  not null check (duration_min between 5 and 600),
  -- de quantos em quantos dias o cliente costuma voltar para este serviço
  return_every_days     int check (return_every_days > 0),
  active                boolean not null default true,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now()
);
create index on public.services (salon_id);

-- Quais profissionais fazem cada serviço (preço/duração podem variar)
create table public.professional_services (
  professional_id       uuid not null references public.professionals(id) on delete cascade,
  service_id            uuid not null references public.services(id) on delete cascade,
  price_cents           int check (price_cents >= 0),
  duration_min          int check (duration_min between 5 and 600),
  primary key (professional_id, service_id)
);

-- ---------------------------------------------------------------------
-- Horário de trabalho semanal. Vários intervalos por dia = intervalo de
-- almoço (ex.: 09:00-12:00 e 13:00-19:00). Dia sem linhas = folga fixa.
-- ---------------------------------------------------------------------
create table public.working_hours (
  id                    uuid primary key default gen_random_uuid(),
  professional_id       uuid not null references public.professionals(id) on delete cascade,
  weekday               smallint not null check (weekday between 0 and 6),
  start_time            time not null,
  end_time              time not null,
  check (end_time > start_time)
);
create index on public.working_hours (professional_id, weekday);

-- Bloqueios pontuais: folgas, férias, médico, feriado...
create table public.time_blocks (
  id                    uuid primary key default gen_random_uuid(),
  professional_id       uuid not null references public.professionals(id) on delete cascade,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  reason                text,
  check (ends_at > starts_at)
);
create index on public.time_blocks (professional_id, starts_at);

-- ---------------------------------------------------------------------
-- Clientes (cada telefone é um lead do salão)
-- ---------------------------------------------------------------------
create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  salon_id              uuid not null references public.salons(id) on delete cascade,
  user_id               uuid references auth.users(id) on delete set null,
  phone                 text not null check (phone ~ '^[0-9]{10,15}$'),
  name                  text,
  birthday              date,
  notes                 text,                -- observações do salão
  -- frequência combinada (7, 15, 30 dias...). Vazio = usar a média ou o serviço
  return_every_days     int check (return_every_days > 0),
  accepts_marketing     boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (salon_id, phone)
);
create index on public.clients (user_id);

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------
create table public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  salon_id              uuid not null references public.salons(id) on delete cascade,
  professional_id       uuid not null references public.professionals(id) on delete restrict,
  client_id             uuid not null references public.clients(id) on delete restrict,
  service_id            uuid not null references public.services(id) on delete restrict,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  status                public.appointment_status not null default 'confirmed',
  price_cents           int not null default 0 check (price_cents >= 0),
  source                text not null default 'client'
                        check (source in ('client', 'salon')),
  notes                 text,
  cancelled_at          timestamptz,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  check (ends_at > starts_at),
  -- impede dois horários sobrepostos para o mesmo profissional
  constraint no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);
create index on public.appointments (salon_id, starts_at);
create index on public.appointments (client_id, starts_at);

-- =====================================================================
-- Funções auxiliares de permissão
-- =====================================================================
create or replace function public.is_salon_member(p_salon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon and user_id = auth.uid()
  );
$$;

create or replace function public.is_salon_owner(p_salon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.my_professional_id(p_salon uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select professional_id from public.salon_members
  where salon_id = p_salon and user_id = auth.uid();
$$;

-- =====================================================================
-- Segurança (RLS): cada um só enxerga o que pode
-- =====================================================================
alter table public.salons                enable row level security;
alter table public.professionals         enable row level security;
alter table public.salon_members         enable row level security;
alter table public.services              enable row level security;
alter table public.professional_services enable row level security;
alter table public.working_hours         enable row level security;
alter table public.time_blocks           enable row level security;
alter table public.clients               enable row level security;
alter table public.appointments          enable row level security;

-- Vitrine pública (o link do salão funciona sem login)
create policy "salão é público" on public.salons
  for select using (true);
create policy "dono edita o salão" on public.salons
  for update using (public.is_salon_owner(id)) with check (public.is_salon_owner(id));

create policy "profissionais ativos são públicos" on public.professionals
  for select using (active or public.is_salon_member(salon_id));
create policy "dono gerencia profissionais" on public.professionals
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "serviços ativos são públicos" on public.services
  for select using (active or public.is_salon_member(salon_id));
create policy "dono gerencia serviços" on public.services
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "serviços por profissional são públicos" on public.professional_services
  for select using (true);
create policy "dono gerencia serviços por profissional" on public.professional_services
  for all using (public.is_salon_owner((select salon_id from public.professionals p where p.id = professional_id)))
  with check (public.is_salon_owner((select salon_id from public.professionals p where p.id = professional_id)));

create policy "horários de trabalho são públicos" on public.working_hours
  for select using (true);
create policy "dono ou o próprio profissional edita horários" on public.working_hours
  for all using (
    exists (select 1 from public.professionals p where p.id = professional_id
            and (public.is_salon_owner(p.salon_id) or public.my_professional_id(p.salon_id) = p.id))
  ) with check (
    exists (select 1 from public.professionals p where p.id = professional_id
            and (public.is_salon_owner(p.salon_id) or public.my_professional_id(p.salon_id) = p.id))
  );

-- Bloqueios: só a equipe vê (o cliente vê só "ocupado" pela função abaixo)
create policy "equipe vê bloqueios" on public.time_blocks
  for select using (
    exists (select 1 from public.professionals p where p.id = professional_id
            and public.is_salon_member(p.salon_id))
  );
create policy "dono ou o próprio profissional edita bloqueios" on public.time_blocks
  for all using (
    exists (select 1 from public.professionals p where p.id = professional_id
            and (public.is_salon_owner(p.salon_id) or public.my_professional_id(p.salon_id) = p.id))
  ) with check (
    exists (select 1 from public.professionals p where p.id = professional_id
            and (public.is_salon_owner(p.salon_id) or public.my_professional_id(p.salon_id) = p.id))
  );

create policy "equipe vê membros" on public.salon_members
  for select using (user_id = auth.uid() or public.is_salon_member(salon_id));
create policy "dono gerencia membros" on public.salon_members
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "equipe vê clientes; cliente vê a si mesmo" on public.clients
  for select using (user_id = auth.uid() or public.is_salon_member(salon_id));
create policy "equipe gerencia clientes" on public.clients
  for all using (public.is_salon_member(salon_id)) with check (public.is_salon_member(salon_id));

create policy "equipe vê agenda; cliente vê os seus" on public.appointments
  for select using (
    public.is_salon_member(salon_id)
    or exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  );
create policy "dono gerencia toda a agenda" on public.appointments
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));
create policy "profissional gerencia a própria agenda" on public.appointments
  for all using (public.my_professional_id(salon_id) = professional_id)
  with check (public.my_professional_id(salon_id) = professional_id);
-- Cliente cria/cancela só pelas funções book_appointment / cancel_appointment.

-- =====================================================================
-- Criação do salão: quem cria vira dono
-- =====================================================================
create or replace function public.create_salon(p_slug text, p_name text, p_whatsapp text default null)
returns public.salons language plpgsql security definer set search_path = public as $$
declare v public.salons;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into public.salons (slug, name, whatsapp) values (lower(p_slug), p_name, p_whatsapp)
  returning * into v;
  insert into public.salon_members (salon_id, user_id, role) values (v.id, auth.uid(), 'owner');
  return v;
end $$;

-- =====================================================================
-- Agenda aberta? (respeita a liberação semanal, ex.: segunda 00:00)
-- Devolve até quando o cliente pode marcar com este profissional.
-- =====================================================================
create or replace function public.booking_open_until(p_professional uuid, p_now timestamptz default now())
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  p public.professionals;
  tz text;
  local_now timestamp;
  last_release timestamp;
  days_since int;
begin
  select * into p from public.professionals where id = p_professional;
  if not found then return null; end if;
  select timezone into tz from public.salons where id = p.salon_id;
  local_now := p_now at time zone tz;

  if p.release_mode = 'rolling' then
    return ((local_now::date + p.release_days_ahead + 1)::timestamp) at time zone tz;
  end if;

  -- última liberação que já aconteceu
  days_since := (extract(dow from local_now)::int - p.release_weekday + 7) % 7;
  last_release := (local_now::date - days_since) + p.release_time;
  if last_release > local_now then
    last_release := last_release - interval '7 days';
  end if;
  -- libera a semana (seg..dom) que começa no dia da liberação, mais semanas extras
  return ((last_release::date + 7 * p.release_weeks_ahead)::timestamp) at time zone tz;
end $$;

-- =====================================================================
-- Horários ocupados (sem expor quem é o cliente)
-- =====================================================================
create or replace function public.busy_slots(p_professional uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at from public.appointments a
   where a.professional_id = p_professional and a.status = 'confirmed'
     and a.starts_at < p_to and a.ends_at > p_from
  union all
  select b.starts_at, b.ends_at from public.time_blocks b
   where b.professional_id = p_professional
     and b.starts_at < p_to and b.ends_at > p_from;
$$;

-- =====================================================================
-- Agendar (cliente logado pelo telefone)
-- =====================================================================
create or replace function public.book_appointment(
  p_professional uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_client_name text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  prof public.professionals;
  svc public.services;
  ps public.professional_services;
  tz text;
  v_phone text;
  v_client public.clients;
  v_dur int;
  v_price int;
  v_end timestamptz;
  local_start timestamp;
  local_end timestamp;
  v_appt public.appointments;
begin
  if auth.uid() is null then raise exception 'Entre com seu telefone para agendar'; end if;

  select * into prof from public.professionals where id = p_professional and active;
  if not found then raise exception 'Profissional não encontrado'; end if;
  select * into svc from public.services where id = p_service and salon_id = prof.salon_id and active;
  if not found then raise exception 'Serviço não encontrado'; end if;
  select * into ps from public.professional_services
   where professional_id = prof.id and service_id = svc.id;
  if not found then raise exception 'Este profissional não faz este serviço'; end if;

  v_dur   := coalesce(ps.duration_min, svc.duration_min);
  v_price := coalesce(ps.price_cents, svc.price_cents);
  v_end   := p_starts_at + make_interval(mins => v_dur);

  if p_starts_at < now() then raise exception 'Este horário já passou'; end if;
  if v_end > public.booking_open_until(prof.id) then
    raise exception 'A agenda para esta data ainda não foi aberta';
  end if;

  -- dentro do horário de trabalho?
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

  -- cliente = telefone do login
  select regexp_replace(coalesce(phone, ''), '\D', '', 'g') into v_phone
    from auth.users where id = auth.uid();
  if v_phone is null or v_phone = '' then raise exception 'Telefone não encontrado no login'; end if;

  insert into public.clients (salon_id, user_id, phone, name)
  values (prof.salon_id, auth.uid(), v_phone, nullif(trim(p_client_name), ''))
  on conflict (salon_id, phone) do update
     set user_id = excluded.user_id,
         name = coalesce(public.clients.name, excluded.name)
  returning * into v_client;

  begin
    insert into public.appointments
      (salon_id, professional_id, client_id, service_id, starts_at, ends_at, price_cents, source)
    values
      (prof.salon_id, prof.id, v_client.id, svc.id, p_starts_at, v_end, v_price, 'client')
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end;

  return v_appt;
end $$;

-- =====================================================================
-- Desmarcar (cliente, dentro do prazo)
-- =====================================================================
create or replace function public.cancel_appointment(p_appointment uuid, p_reason text default null)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  min_hours int;
  is_staff boolean;
begin
  select * into a from public.appointments where id = p_appointment;
  if not found then raise exception 'Agendamento não encontrado'; end if;

  is_staff := public.is_salon_member(a.salon_id);
  if not is_staff and not exists (
    select 1 from public.clients c where c.id = a.client_id and c.user_id = auth.uid()
  ) then
    raise exception 'Sem permissão';
  end if;
  if a.status <> 'confirmed' then raise exception 'Este agendamento não está ativo'; end if;

  select cancel_min_hours into min_hours from public.salons where id = a.salon_id;
  if not is_staff and a.starts_at - now() < make_interval(hours => min_hours) then
    raise exception 'Prazo para desmarcar pelo app acabou. Fale com o salão pelo WhatsApp.';
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = a.id
  returning * into a;
  return a;
end $$;

-- =====================================================================
-- Clientes como leads: última visita, frequência e quem está "sumido"
-- =====================================================================
create or replace view public.client_stats
with (security_invoker = true) as
select
  c.id as client_id,
  c.salon_id,
  c.name,
  c.phone,
  c.created_at,
  count(a.id) filter (where a.status = 'completed')                    as visits,
  max(a.starts_at) filter (where a.status = 'completed')               as last_visit_at,
  min(a.starts_at) filter (where a.status = 'confirmed' and a.starts_at > now()) as next_appointment_at,
  coalesce(sum(a.price_cents) filter (where a.status = 'completed'), 0) as total_spent_cents,
  count(a.id) filter (where a.status = 'no_show')                      as no_shows,
  -- frequência: a combinada, senão a média real entre visitas
  coalesce(
    c.return_every_days,
    case when count(a.id) filter (where a.status = 'completed') >= 2 then
      round(extract(epoch from (
        max(a.starts_at) filter (where a.status = 'completed')
        - min(a.starts_at) filter (where a.status = 'completed')
      )) / 86400.0 / (count(a.id) filter (where a.status = 'completed') - 1))::int
    end
  ) as return_every_days
from public.clients c
left join public.appointments a on a.client_id = c.id
group by c.id;

comment on view public.client_stats is
  'Histórico resumido por cliente. "Sumido" = sem agendamento futuro e última visita há mais que a frequência (ou que salons.inactive_after_days).';

-- =====================================================================
-- Permissões para a API do Supabase
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
revoke execute on function public.create_salon(text, text, text) from public, anon;
revoke execute on function public.book_appointment(uuid, uuid, timestamptz, text) from public, anon;
revoke execute on function public.cancel_appointment(uuid, text) from public, anon;

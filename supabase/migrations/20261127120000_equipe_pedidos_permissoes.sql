-- Funcionário pede para entrar no salão; o dono aprova e define o que ele pode fazer.

alter table public.salon_members add column if not exists permissions text[] not null default '{}';

-- Dono pode tudo; funcionário só o que o dono liberou.
create or replace function public.has_permission(p_salon uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon and user_id = auth.uid()
      and (role = 'owner' or p_perm = any(permissions))
  );
$$;
grant execute on function public.has_permission(uuid, text) to authenticated;

create table if not exists public.salon_join_requests (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  professional_id uuid references public.professionals(id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create unique index if not exists salon_join_requests_pending_idx
  on public.salon_join_requests (salon_id, user_id) where status = 'pending';
alter table public.salon_join_requests enable row level security;
create policy "dono e o próprio funcionário veem pedidos de entrada" on public.salon_join_requests
  for select using (user_id = auth.uid() or public.is_salon_owner(salon_id));

create or replace function public.request_join_salon(p_salon uuid, p_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then raise exception 'Entre na sua conta primeiro.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Digite seu nome.'; end if;
  if not exists (select 1 from public.salons where id = p_salon) then raise exception 'Salão não encontrado.'; end if;
  if exists (select 1 from public.salon_members where salon_id = p_salon and user_id = me) then
    raise exception 'Você já faz parte deste salão.';
  end if;
  select id into v_id from public.salon_join_requests where salon_id = p_salon and user_id = me and status = 'pending';
  if v_id is not null then return v_id; end if;
  insert into public.salon_join_requests (salon_id, user_id, name, phone, email)
  values (p_salon, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), auth.jwt() ->> 'email')
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.request_join_salon(uuid, text, text) to authenticated;

create or replace function public.cancel_join_request(p_request uuid)
returns void language sql security definer set search_path = public as $$
  update public.salon_join_requests set status = 'cancelled', handled_at = now()
  where id = p_request and user_id = auth.uid() and status = 'pending';
$$;
grant execute on function public.cancel_join_request(uuid) to authenticated;

-- Dono aprova (ligando a um profissional existente ou criando um novo) ou recusa.
create or replace function public.handle_join_request(
  p_request uuid, p_accept boolean, p_professional uuid default null, p_permissions text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.salon_join_requests;
  v_pro uuid := p_professional;
begin
  select * into r from public.salon_join_requests where id = p_request for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_salon_owner(r.salon_id) then raise exception 'Só o dono do salão pode responder.'; end if;
  if r.status <> 'pending' then raise exception 'Este pedido já foi respondido.'; end if;

  if not p_accept then
    update public.salon_join_requests set status = 'declined', handled_at = now(), handled_by = auth.uid() where id = r.id;
    return null;
  end if;

  if v_pro is null then
    insert into public.professionals (salon_id, name, phone, user_id)
    values (r.salon_id, r.name, r.phone, r.user_id) returning id into v_pro;
  else
    if not exists (select 1 from public.professionals where id = v_pro and salon_id = r.salon_id) then
      raise exception 'Profissional não encontrado.';
    end if;
    if exists (select 1 from public.salon_members where salon_id = r.salon_id and professional_id = v_pro and user_id <> r.user_id) then
      raise exception 'Esse profissional já está ligado a outra conta. Remova o acesso antigo primeiro.';
    end if;
    update public.professionals set user_id = r.user_id where id = v_pro;
  end if;

  insert into public.salon_members (salon_id, user_id, role, professional_id, permissions)
  values (r.salon_id, r.user_id, 'professional', v_pro, coalesce(p_permissions, '{}'))
  on conflict (salon_id, user_id) do update
    set professional_id = excluded.professional_id, permissions = excluded.permissions;

  update public.salon_join_requests
    set status = 'approved', professional_id = v_pro, handled_at = now(), handled_by = auth.uid()
    where id = r.id;
  return v_pro;
end $$;
grant execute on function public.handle_join_request(uuid, boolean, uuid, text[]) to authenticated;

-- Permissão "precos": alterar serviços e preços.
create policy "funcionário com permissão gerencia serviços" on public.services
  for all using (public.has_permission(salon_id, 'precos')) with check (public.has_permission(salon_id, 'precos'));
create policy "funcionário com permissão gerencia serviços por profissional" on public.professional_services
  for all using (public.has_permission((select p.salon_id from public.professionals p where p.id = professional_id), 'precos'))
  with check (public.has_permission((select p.salon_id from public.professionals p where p.id = professional_id), 'precos'));

-- Permissão "agenda_equipe": mexer na agenda de toda a equipe.
create policy "funcionário com permissão gerencia toda a agenda" on public.appointments
  for all using (public.has_permission(salon_id, 'agenda_equipe')) with check (public.has_permission(salon_id, 'agenda_equipe'));

create or replace function public.book_by_staff(p_professional uuid, p_service uuid, p_starts_at timestamp with time zone, p_name text, p_phone text, p_notes text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  prof public.professionals;
  svc public.services;
  ps public.professional_services;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_client public.clients;
  v_appt public.appointments;
begin
  select * into prof from public.professionals where id = p_professional;
  if not found then raise exception 'Profissional não encontrado'; end if;
  if not coalesce(public.is_salon_owner(prof.salon_id)
                  or public.my_professional_id(prof.salon_id) = prof.id
                  or public.has_permission(prof.salon_id, 'agenda_equipe'), false) then
    raise exception 'Sem permissão para agendar para este profissional';
  end if;
  select * into svc from public.services where id = p_service and salon_id = prof.salon_id;
  if not found then raise exception 'Serviço não encontrado'; end if;
  select * into ps from public.professional_services where professional_id = prof.id and service_id = svc.id;

  if v_phone !~ '^55' then v_phone := '55' || v_phone; end if;
  if v_phone !~ '^55[0-9]{10,11}$' then raise exception 'Telefone inválido. Use DDD + número.'; end if;

  insert into public.clients (salon_id, phone, name)
  values (prof.salon_id, v_phone, nullif(trim(p_name), ''))
  on conflict (salon_id, phone) do update
     set name = coalesce(public.clients.name, excluded.name)
  returning * into v_client;

  begin
    insert into public.appointments
      (salon_id, professional_id, client_id, service_id, starts_at, ends_at, price_cents, source, notes)
    values
      (prof.salon_id, prof.id, v_client.id, svc.id, p_starts_at,
       p_starts_at + make_interval(mins => coalesce(ps.duration_min, svc.duration_min)),
       coalesce(ps.price_cents, svc.price_cents), 'salon', nullif(trim(p_notes), ''))
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'Já existe um horário marcado nesse período para este profissional.';
  end;
  return v_appt.id;
end $function$;

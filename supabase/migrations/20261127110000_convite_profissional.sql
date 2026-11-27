-- Convite para o profissional entrar no app e ver só a própria agenda.
create table if not exists public.professional_invites (
  token uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);
create index if not exists professional_invites_pro_idx on public.professional_invites (professional_id);
alter table public.professional_invites enable row level security;
create policy "dono gerencia convites" on public.professional_invites
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

-- Dados públicos do convite (para a página /convite/[token]).
create or replace function public.invite_info(p_token uuid)
returns table (salon_name text, salon_slug text, professional_name text, status text)
language sql stable security definer set search_path = public as $$
  select s.name, s.slug, p.name,
    case
      when i.accepted_at is not null then 'usado'
      when i.expires_at < now() then 'vencido'
      else 'ok'
    end
  from public.professional_invites i
  join public.salons s on s.id = i.salon_id
  join public.professionals p on p.id = i.professional_id
  where i.token = p_token;
$$;
grant execute on function public.invite_info(uuid) to anon, authenticated;

-- Aceita o convite: a conta logada vira profissional do salão.
create or replace function public.accept_professional_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v public.professional_invites;
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'Entre na sua conta para aceitar o convite.'; end if;
  select * into v from public.professional_invites where token = p_token for update;
  if not found then raise exception 'Convite não encontrado.'; end if;
  if v.accepted_at is not null then
    if v.accepted_by = me then return v.salon_id; end if;
    raise exception 'Este convite já foi usado. Peça um novo ao dono do salão.';
  end if;
  if v.expires_at < now() then raise exception 'Este convite venceu. Peça um novo ao dono do salão.'; end if;
  if exists (select 1 from public.salon_members where salon_id = v.salon_id and user_id = me and role = 'owner') then
    raise exception 'Você já é o dono deste salão.';
  end if;
  select user_id into other from public.salon_members
    where salon_id = v.salon_id and professional_id = v.professional_id and user_id <> me;
  if other is not null then
    raise exception 'Este profissional já tem acesso com outra conta. Peça ao dono para remover o acesso antigo.';
  end if;

  insert into public.salon_members (salon_id, user_id, role, professional_id)
  values (v.salon_id, me, 'professional', v.professional_id)
  on conflict (salon_id, user_id) do update set professional_id = excluded.professional_id;
  update public.professionals set user_id = me where id = v.professional_id;
  update public.professional_invites set accepted_by = me, accepted_at = now() where token = p_token;
  return v.salon_id;
end;
$$;
grant execute on function public.accept_professional_invite(uuid) to authenticated;

-- Quem da equipe já tem acesso (só o dono vê os e-mails).
create or replace function public.team_access(p_salon uuid)
returns table (professional_id uuid, user_id uuid, email text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select m.professional_id, m.user_id, u.email::text, m.created_at
  from public.salon_members m
  join auth.users u on u.id = m.user_id
  where m.salon_id = p_salon and m.role = 'professional' and public.is_salon_owner(p_salon);
$$;
grant execute on function public.team_access(uuid) to authenticated;

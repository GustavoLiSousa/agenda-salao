-- Só cria salão quem tem um código de convite gerado pelo administrador da plataforma.
-- Os administradores são cadastrados direto na tabela platform_admins (pelo painel do Supabase).

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "admin ve a si mesmo" on public.platform_admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create table if not exists public.salon_invite_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  salon_id uuid references public.salons(id) on delete set null
);
alter table public.salon_invite_codes enable row level security;
create policy "admin ve os codigos" on public.salon_invite_codes for select to authenticated using (public.is_platform_admin());
create policy "admin cria codigos" on public.salon_invite_codes for insert to authenticated with check (public.is_platform_admin());
create policy "admin altera codigos" on public.salon_invite_codes for update to authenticated using (public.is_platform_admin());

-- Criar salão com código
create or replace function public.create_salon(p_slug text, p_name text, p_whatsapp text, p_code text)
returns public.salons language plpgsql security definer set search_path = public as $$
declare v public.salons; c public.salon_invite_codes; admin boolean := public.is_platform_admin();
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if not admin then
    select * into c from public.salon_invite_codes where code = upper(trim(coalesce(p_code, ''))) for update;
    if not found or c.revoked_at is not null then raise exception 'Código de convite inválido. Confira com quem te enviou.'; end if;
    if c.used_at is not null then raise exception 'Este código de convite já foi usado.'; end if;
    if c.expires_at is not null and c.expires_at < now() then raise exception 'Este código de convite venceu. Peça um novo.'; end if;
  end if;
  insert into public.salons (slug, name, whatsapp) values (lower(p_slug), p_name, p_whatsapp) returning * into v;
  insert into public.salon_members (salon_id, user_id, role) values (v.id, auth.uid(), 'owner');
  if not admin then
    update public.salon_invite_codes set used_by = auth.uid(), used_at = now(), salon_id = v.id where code = c.code;
  end if;
  return v;
end $$;

-- A versão antiga (sem código) passa a valer só para o administrador
create or replace function public.create_salon(p_slug text, p_name text, p_whatsapp text default null)
returns public.salons language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Para criar um salão é preciso um código de convite.'; end if;
  return public.create_salon(p_slug, p_name, p_whatsapp, null::text);
end $$;

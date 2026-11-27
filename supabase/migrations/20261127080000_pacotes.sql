-- =====================================================================
-- Etapa: pacotes
--
-- O dono cria pacotes (ex.: "4 cortes por R$ 150, válido 60 dias").
-- Aparecem na página do salão. A venda é feita no balcão: a equipe
-- registra no cliente e o sistema controla o saldo de cada serviço.
-- (Pagamento online dos pacotes entra na etapa de pagamentos.)
-- Só cria coisas novas: nada existente é apagado.
-- =====================================================================

create table public.packages (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 80),
  description     text check (char_length(description) <= 400),
  price_cents     int  not null check (price_cents >= 0),
  validity_days   int  check (validity_days between 1 and 730),
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.packages (salon_id);

create table public.package_items (
  package_id      uuid not null references public.packages(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete cascade,
  quantity        int  not null check (quantity between 1 and 100),
  primary key (package_id, service_id)
);

-- Pacote vendido para um cliente (cópia do pacote no momento da venda)
create table public.client_packages (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete restrict,
  package_id      uuid references public.packages(id) on delete set null,
  name            text not null,
  price_cents     int  not null check (price_cents >= 0),
  purchased_at    timestamptz not null default now(),
  expires_at      timestamptz,
  status          text not null default 'active' check (status in ('active', 'cancelled')),
  notes           text check (char_length(notes) <= 300),
  sold_by         uuid references auth.users(id) on delete set null
);
create index on public.client_packages (client_id);
create index on public.client_packages (salon_id, purchased_at desc);

create table public.client_package_items (
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  service_id        uuid not null references public.services(id) on delete restrict,
  quantity          int  not null check (quantity >= 1),
  used              int  not null default 0 check (used >= 0),
  primary key (client_package_id, service_id),
  check (used <= quantity)
);

-- Cada sessão usada (para histórico e para desfazer)
create table public.package_uses (
  id                uuid primary key default gen_random_uuid(),
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  service_id        uuid not null references public.services(id) on delete restrict,
  appointment_id    uuid references public.appointments(id) on delete set null,
  used_at           timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  undone_at         timestamptz           -- desfeito (marcado por engano)
);
create index on public.package_uses (client_package_id, used_at desc);

alter table public.packages             enable row level security;
alter table public.package_items        enable row level security;
alter table public.client_packages      enable row level security;
alter table public.client_package_items enable row level security;
alter table public.package_uses         enable row level security;

-- Vitrine: pacotes ativos são públicos; o dono gerencia
create policy "pacotes ativos são públicos" on public.packages
  for select using (active or public.is_salon_member(salon_id));
create policy "dono gerencia pacotes" on public.packages
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "itens de pacote são públicos" on public.package_items
  for select using (true);
create policy "dono gerencia itens de pacote" on public.package_items
  for all using (public.is_salon_owner((select salon_id from public.packages p where p.id = package_id)))
  with check (public.is_salon_owner((select salon_id from public.packages p where p.id = package_id)));

-- Pacotes vendidos: equipe vê; o cliente vê os seus. Mudanças só pelas funções abaixo,
-- exceto o dono, que pode cancelar/editar.
create policy "equipe e o próprio cliente veem pacotes vendidos" on public.client_packages
  for select using (
    public.is_salon_member(salon_id)
    or exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  );
create policy "dono edita pacotes vendidos" on public.client_packages
  for update using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

create policy "equipe e o próprio cliente veem saldo" on public.client_package_items
  for select using (exists (
    select 1 from public.client_packages cp
     where cp.id = client_package_id
       and (public.is_salon_member(cp.salon_id)
            or exists (select 1 from public.clients c where c.id = cp.client_id and c.user_id = auth.uid()))
  ));

create policy "equipe vê usos de pacote" on public.package_uses
  for select using (exists (
    select 1 from public.client_packages cp
     where cp.id = client_package_id and public.is_salon_member(cp.salon_id)
  ));

-- ---------------------------------------------------------------------
-- Vender um pacote para um cliente (equipe do salão)
-- ---------------------------------------------------------------------
create or replace function public.sell_package(
  p_client uuid,
  p_package uuid,
  p_price_cents int default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pk public.packages;
  cl public.clients;
  v_id uuid;
begin
  select * into pk from public.packages where id = p_package;
  if not found then raise exception 'Pacote não encontrado'; end if;
  if not public.is_salon_member(pk.salon_id) then raise exception 'Sem permissão'; end if;
  select * into cl from public.clients where id = p_client and salon_id = pk.salon_id;
  if not found then raise exception 'Cliente não encontrado'; end if;
  if not exists (select 1 from public.package_items where package_id = pk.id) then
    raise exception 'Este pacote ainda não tem serviços';
  end if;
  if p_price_cents is not null and p_price_cents < 0 then raise exception 'Valor inválido'; end if;

  insert into public.client_packages (salon_id, client_id, package_id, name, price_cents, expires_at, notes, sold_by)
  values (pk.salon_id, cl.id, pk.id, pk.name, coalesce(p_price_cents, pk.price_cents),
          case when pk.validity_days is not null then now() + make_interval(days => pk.validity_days) end,
          nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_id;

  insert into public.client_package_items (client_package_id, service_id, quantity)
  select v_id, service_id, quantity from public.package_items where package_id = pk.id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Usar uma sessão do pacote (equipe do salão)
-- ---------------------------------------------------------------------
create or replace function public.use_package(
  p_client_package uuid,
  p_service uuid,
  p_appointment uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  cp public.client_packages;
  it public.client_package_items;
begin
  select * into cp from public.client_packages where id = p_client_package for update;
  if not found then raise exception 'Pacote não encontrado'; end if;
  if not public.is_salon_member(cp.salon_id) then raise exception 'Sem permissão'; end if;
  if cp.status <> 'active' then raise exception 'Este pacote foi cancelado'; end if;
  if cp.expires_at is not null and cp.expires_at < now() then raise exception 'Este pacote venceu'; end if;
  select * into it from public.client_package_items
   where client_package_id = cp.id and service_id = p_service for update;
  if not found then raise exception 'Este serviço não faz parte do pacote'; end if;
  if it.used >= it.quantity then raise exception 'Não há mais sessões deste serviço no pacote'; end if;

  update public.client_package_items set used = used + 1
   where client_package_id = cp.id and service_id = p_service;
  insert into public.package_uses (client_package_id, service_id, appointment_id, created_by)
  values (cp.id, p_service, p_appointment, auth.uid());
end $$;

-- Desfazer um uso (marcado por engano)
create or replace function public.undo_package_use(p_use uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  u public.package_uses;
  cp public.client_packages;
begin
  select * into u from public.package_uses where id = p_use and undone_at is null;
  if not found then raise exception 'Uso não encontrado'; end if;
  select * into cp from public.client_packages where id = u.client_package_id;
  if not public.is_salon_member(cp.salon_id) then raise exception 'Sem permissão'; end if;
  update public.client_package_items set used = greatest(used - 1, 0)
   where client_package_id = u.client_package_id and service_id = u.service_id;
  update public.package_uses set undone_at = now() where id = u.id;
end $$;

-- ---------------------------------------------------------------------
-- "Meus pacotes" do cliente logado (todos os salões)
-- ---------------------------------------------------------------------
create or replace function public.my_packages()
returns table (
  id uuid,
  name text,
  status text,
  purchased_at timestamptz,
  expires_at timestamptz,
  salon_name text,
  salon_slug text,
  items jsonb
)
language sql stable security definer set search_path = public as $$
  select cp.id, cp.name, cp.status, cp.purchased_at, cp.expires_at, sa.name, sa.slug,
         coalesce((
           select jsonb_agg(jsonb_build_object('service', s.name, 'quantity', i.quantity, 'used', i.used) order by s.name)
             from public.client_package_items i
             join public.services s on s.id = i.service_id
            where i.client_package_id = cp.id
         ), '[]'::jsonb)
    from public.client_packages cp
    join public.clients c on c.id = cp.client_id
    join public.salons sa on sa.id = cp.salon_id
   where auth.uid() is not null and c.user_id = auth.uid()
   order by cp.purchased_at desc
   limit 100;
$$;

revoke execute on function public.sell_package(uuid, uuid, int, text) from public, anon;
revoke execute on function public.use_package(uuid, uuid, uuid) from public, anon;
revoke execute on function public.undo_package_use(uuid) from public, anon;
revoke execute on function public.my_packages() from public, anon;
grant execute on function public.sell_package(uuid, uuid, int, text) to authenticated;
grant execute on function public.use_package(uuid, uuid, uuid) to authenticated;
grant execute on function public.undo_package_use(uuid) to authenticated;
grant execute on function public.my_packages() to authenticated;

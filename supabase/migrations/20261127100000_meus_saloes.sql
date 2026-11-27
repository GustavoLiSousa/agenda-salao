-- =====================================================================
-- Etapa: área do cliente — salões salvos e pedido de pacote
--
-- O cliente logado salva um salão como "meu" (fica fixo na área dele)
-- e pode pedir um pacote pelo app. O salão confirma a venda no painel
-- (o pagamento online continua para depois). Só cria coisas novas.
-- =====================================================================

create table public.client_favorite_salons (
  user_id    uuid not null references auth.users(id) on delete cascade,
  salon_id   uuid not null references public.salons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, salon_id)
);
alter table public.client_favorite_salons enable row level security;
create policy "cliente vê os salões que salvou" on public.client_favorite_salons
  for select using (user_id = auth.uid());
create policy "cliente salva salões" on public.client_favorite_salons
  for insert with check (user_id = auth.uid());
create policy "cliente remove salões salvos" on public.client_favorite_salons
  for delete using (user_id = auth.uid());

-- Pedidos de pacote feitos pelo cliente no app
create table public.package_requests (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references public.salons(id) on delete cascade,
  package_id        uuid not null references public.packages(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  status            text not null default 'pending' check (status in ('pending', 'sold', 'declined', 'cancelled')),
  client_package_id uuid references public.client_packages(id) on delete set null,
  created_at        timestamptz not null default now(),
  handled_at        timestamptz,
  handled_by        uuid references auth.users(id) on delete set null
);
create index on public.package_requests (salon_id, status, created_at desc);
create index on public.package_requests (user_id);
create unique index package_requests_one_pending
  on public.package_requests (package_id, client_id) where status = 'pending';
alter table public.package_requests enable row level security;
create policy "equipe e o próprio cliente veem pedidos de pacote" on public.package_requests
  for select using (user_id = auth.uid() or public.is_salon_member(salon_id));

-- Cliente pede um pacote (cadastra/atualiza o cliente no salão)
create or replace function public.request_package(p_package uuid, p_name text, p_phone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pk public.packages;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_client public.clients;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para pedir um pacote'; end if;
  select * into pk from public.packages where id = p_package and active;
  if not found then raise exception 'Pacote não encontrado'; end if;
  if v_name is null or char_length(v_name) < 2 then raise exception 'Informe seu nome'; end if;
  if v_phone !~ '^55' then v_phone := '55' || v_phone; end if;
  if v_phone !~ '^55[0-9]{10,11}$' then
    raise exception 'Telefone inválido. Use DDD + número, ex.: 11 99999-9999';
  end if;

  insert into public.clients (salon_id, phone, name, user_id)
  values (pk.salon_id, v_phone, left(v_name, 80), auth.uid())
  on conflict (salon_id, phone) do update
     set name = coalesce(public.clients.name, excluded.name),
         user_id = coalesce(public.clients.user_id, excluded.user_id)
  returning * into v_client;

  begin
    insert into public.package_requests (salon_id, package_id, client_id, user_id)
    values (pk.salon_id, pk.id, v_client.id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Você já pediu este pacote. O salão vai confirmar com você.';
  end;
  return v_id;
end $$;

-- Cliente desiste do pedido
create or replace function public.cancel_package_request(p_request uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.package_requests set status = 'cancelled', handled_at = now()
   where id = p_request and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pedido não encontrado'; end if;
end $$;

-- Salão confirma (registra a venda) ou recusa o pedido
create or replace function public.handle_package_request(p_request uuid, p_accept boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r public.package_requests;
  v_cp uuid;
begin
  select * into r from public.package_requests where id = p_request for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if not public.is_salon_member(r.salon_id) then raise exception 'Sem permissão'; end if;
  if r.status <> 'pending' then raise exception 'Este pedido já foi respondido'; end if;
  if p_accept then
    v_cp := public.sell_package(r.client_id, r.package_id, null, 'Pedido pelo app');
  end if;
  update public.package_requests
     set status = case when p_accept then 'sold' else 'declined' end,
         client_package_id = v_cp, handled_at = now(), handled_by = auth.uid()
   where id = r.id;
  return v_cp;
end $$;

-- Pedidos do cliente logado (todos os salões)
create or replace function public.my_package_requests()
returns table (id uuid, status text, created_at timestamptz, package_id uuid, package_name text,
               price_cents int, salon_name text, salon_slug text)
language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.created_at, p.id, p.name, p.price_cents, s.name, s.slug
    from public.package_requests r
    join public.packages p on p.id = r.package_id
    join public.salons s on s.id = r.salon_id
   where auth.uid() is not null and r.user_id = auth.uid()
     and (r.status = 'pending' or r.handled_at > now() - interval '7 days')
   order by r.created_at desc
   limit 50;
$$;

revoke execute on function public.request_package(uuid, text, text) from public, anon;
revoke execute on function public.cancel_package_request(uuid) from public, anon;
revoke execute on function public.handle_package_request(uuid, boolean) from public, anon;
revoke execute on function public.my_package_requests() from public, anon;
grant execute on function public.request_package(uuid, text, text) to authenticated;
grant execute on function public.cancel_package_request(uuid) to authenticated;
grant execute on function public.handle_package_request(uuid, boolean) to authenticated;
grant execute on function public.my_package_requests() to authenticated;

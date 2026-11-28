-- Auditoria: tudo o que muda no salão fica registrado (quem, quando, o quê).
-- Só o dono do salão consegue ler. Ninguém consegue alterar ou apagar registros pelo app.

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  salon_id uuid, -- sem chave estrangeira: o registro fica mesmo se o item (ou o salão) for apagado
  actor_id uuid,
  actor_label text not null,
  actor_kind text not null check (actor_kind in ('dono', 'equipe', 'cliente', 'sistema')),
  action text not null check (action in ('criou', 'alterou', 'apagou')),
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_salon_created on public.audit_logs (salon_id, created_at desc);
alter table public.audit_logs enable row level security;
create policy "dono le a auditoria" on public.audit_logs for select to authenticated
  using (public.is_salon_owner(salon_id));

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  r jsonb := coalesce(n, o);
  v_salon uuid;
  v_uid uuid := auth.uid();
  v_label text;
  v_kind text;
  v_details jsonb;
  k text;
  ch_before jsonb := '{}'::jsonb;
  ch_after jsonb := '{}'::jsonb;
begin
  -- descobre o salão da linha
  if tg_table_name = 'salons' then v_salon := (r->>'id')::uuid;
  elsif r ? 'salon_id' then v_salon := (r->>'salon_id')::uuid;
  elsif r ? 'professional_id' then select salon_id into v_salon from professionals where id = (r->>'professional_id')::uuid;
  elsif r ? 'client_package_id' then select salon_id into v_salon from client_packages where id = (r->>'client_package_id')::uuid;
  elsif r ? 'package_id' then select salon_id into v_salon from packages where id = (r->>'package_id')::uuid;
  end if;

  -- o que mudou (sem campos internos)
  n := n - 'manage_token'; o := o - 'manage_token';
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if (o->k) is distinct from (n->k) then
        ch_before := ch_before || jsonb_build_object(k, o->k);
        ch_after := ch_after || jsonb_build_object(k, n->k);
      end if;
    end loop;
    if ch_after = '{}'::jsonb then return null; end if;
    v_details := jsonb_build_object('antes', ch_before, 'depois', ch_after);
  elsif tg_op = 'INSERT' then v_details := jsonb_build_object('depois', n);
  else v_details := jsonb_build_object('antes', o);
  end if;

  -- quem fez
  if v_uid is null then
    v_kind := 'sistema'; v_label := case when tg_table_name in ('appointments', 'clients', 'reviews') then 'Cliente pelo link' else 'Sistema' end;
  else
    select case when m.role = 'owner' then 'dono' else 'equipe' end,
           coalesce(p.name, u.raw_user_meta_data->>'full_name', u.email, 'Equipe')
             || case when m.role = 'owner' then ' (dono)' else '' end
      into v_kind, v_label
      from salon_members m
      left join professionals p on p.id = m.professional_id
      left join auth.users u on u.id = m.user_id
     where m.salon_id = v_salon and m.user_id = v_uid;
    if v_kind is null then
      select 'cliente', 'Cliente ' || coalesce(c.name, c.phone) into v_kind, v_label
        from clients c where c.salon_id = v_salon and c.user_id = v_uid limit 1;
    end if;
    if v_kind is null then
      select 'cliente', coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email, 'Usuário')
        into v_kind, v_label from auth.users u where u.id = v_uid;
    end if;
  end if;

  insert into audit_logs (salon_id, actor_id, actor_label, actor_kind, action, entity, entity_id, details)
  values (
    v_salon, v_uid, coalesce(v_label, 'Sistema'), coalesce(v_kind, 'sistema'),
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'apagou' end,
    tg_table_name,
    coalesce(r->>'id', r->>'code', r->>'user_id'),
    v_details
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'appointments', 'clients', 'services', 'professionals', 'professional_services', 'working_hours', 'time_blocks',
    'packages', 'package_items', 'client_packages', 'package_uses', 'package_requests', 'reviews', 'salon_members',
    'salon_join_requests', 'salons', 'deposit_rules', 'payments'
  ] loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()',
      t
    );
  end loop;
end $$;

-- =====================================================================
-- Etapa 5: agenda do salão
-- Agendar pelo balcão (dono ou profissional), sem as travas do link público:
-- pode marcar antes da agenda abrir e fora do expediente (encaixe),
-- mas nunca em cima de outro horário do mesmo profissional.
-- =====================================================================
create or replace function public.book_by_staff(
  p_professional uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
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
  if not coalesce(public.is_salon_owner(prof.salon_id) or public.my_professional_id(prof.salon_id) = prof.id, false) then
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
end $$;

revoke execute on function public.book_by_staff(uuid, uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.book_by_staff(uuid, uuid, timestamptz, text, text, text) to authenticated;

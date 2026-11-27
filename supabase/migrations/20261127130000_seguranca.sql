-- =====================================================================
-- Etapa: ajustes de segurança antes de vender
--
-- 1. Tira do acesso público funções internas que o site não usa.
--    (Só tira permissão; nada é apagado. Para desfazer, basta um grant.)
-- 2. Limite contra agendamentos falsos em massa pelo link público:
--    no máximo 30 agendamentos feitos por clientes em 10 minutos por salão.
-- =====================================================================

-- Função interna do Supabase (liga a trava de segurança em tabelas novas)
-- (criada pelo próprio Supabase em alguns projetos; por isso o "se existir")
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Limpeza de reservas de sinal vencidas: só o banco/servidor deve rodar
revoke execute on function public.release_expired_holds() from public, anon, authenticated;

-- Não usadas pelo site (substituídas por available_slots / book_as_guest /
-- my_appointments_v2 / pedidos de entrada na equipe)
revoke execute on function public.busy_slots(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.book_appointment(uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.my_appointments() from public, anon, authenticated;
revoke execute on function public.invite_info(uuid) from public, anon, authenticated;
revoke execute on function public.accept_professional_invite(uuid) from public, anon, authenticated;

create index if not exists appointments_salon_created_idx on public.appointments (salon_id, created_at);

-- Agendamento pelo link público, agora com limite por salão
create or replace function public.book_as_guest(
  p_professional uuid, p_service uuid, p_starts_at timestamptz, p_name text, p_phone text
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

  -- Proteção contra robôs: muitos agendamentos seguidos no mesmo salão
  if (select count(*) from public.appointments
       where salon_id = v_salon and source = 'client'
         and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Muitos agendamentos agora. Tente de novo em alguns minutos ou fale com o salão pelo WhatsApp.';
  end if;

  insert into public.clients (salon_id, phone, name)
  values (v_salon, v_phone, v_name)
  on conflict (salon_id, phone) do update
     set name = coalesce(public.clients.name, excluded.name)
  returning * into v_client;

  if (select count(*) from public.appointments
       where client_id = v_client.id and status = 'confirmed' and starts_at > now()
         and not (payment_status is not distinct from 'pending' and hold_expires_at < now())) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Fale com o salão pelo WhatsApp.';
  end if;

  v_appt := public._insert_appointment(p_professional, p_service, p_starts_at, v_client.id, 'client');

  v_deposit := public.deposit_required(v_salon, v_appt.starts_at, v_appt.price_cents);
  if v_deposit is not null and v_deposit > 0 then
    update public.appointments
       set deposit_cents = v_deposit, payment_status = 'pending', hold_expires_at = now() + interval '15 minutes'
     where id = v_appt.id;
  end if;

  return v_appt.manage_token;
end $$;

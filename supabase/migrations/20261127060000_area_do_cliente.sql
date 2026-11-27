-- =====================================================================
-- Etapa: área do cliente ("Meus agendamentos")
--
-- O cliente entra com Google ou com um código por e-mail. Para não deixar
-- ninguém ver os horários de outra pessoa só digitando um telefone, a conta
-- é ligada ao cadastro do cliente (salão + telefone) apenas por quem tem o
-- link pessoal de um agendamento (manage_token), que só o próprio cliente
-- recebe ao agendar.
-- =====================================================================

-- "minha-conta" passa a ser endereço do site (não pode virar link de salão)
alter table public.salons drop constraint if exists salons_slug_not_reserved;
alter table public.salons
  add constraint salons_slug_not_reserved
  check (slug not in ('entrar', 'sair', 'painel', 'auth', 'api', 'admin', 'app', 'minha-conta'));

-- ---------------------------------------------------------------------
-- Liga o login atual ao cliente dono deste agendamento.
-- Devolve true quando ligou (ou já estava ligado).
-- ---------------------------------------------------------------------
create or replace function public.claim_appointment(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
begin
  if auth.uid() is null then return false; end if;
  select client_id into v_client from public.appointments where manage_token = p_token;
  if v_client is null then return false; end if;
  update public.clients set user_id = auth.uid()
   where id = v_client and user_id is distinct from auth.uid();
  return true;
end $$;
revoke execute on function public.claim_appointment(uuid) from public, anon;
grant execute on function public.claim_appointment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Todos os agendamentos do cliente logado, em todos os salões.
-- ---------------------------------------------------------------------
create or replace function public.my_appointments()
returns table (
  manage_token uuid,
  status public.appointment_status,
  starts_at timestamptz,
  ends_at timestamptz,
  price_cents int,
  service_name text,
  professional_name text,
  professional_photo text,
  salon_name text,
  salon_slug text,
  salon_logo text,
  salon_whatsapp text,
  salon_address text,
  salon_timezone text,
  cancel_min_hours int
)
language sql stable security definer set search_path = public as $$
  select a.manage_token, a.status, a.starts_at, a.ends_at, a.price_cents,
         s.name, p.name, p.photo_url,
         sa.name, sa.slug, sa.logo_url, sa.whatsapp, sa.address, sa.timezone, sa.cancel_min_hours
    from public.clients c
    join public.appointments a on a.client_id = c.id
    join public.services s on s.id = a.service_id
    join public.professionals p on p.id = a.professional_id
    join public.salons sa on sa.id = a.salon_id
   where auth.uid() is not null and c.user_id = auth.uid()
   order by a.starts_at desc
   limit 300;
$$;
revoke execute on function public.my_appointments() from public, anon;
grant execute on function public.my_appointments() to authenticated;

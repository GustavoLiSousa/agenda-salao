-- Foto do perfil do cliente aparece no painel do salão.
alter table public.clients add column if not exists avatar_url text;

-- Sempre que um cadastro de cliente é ligado a uma conta, copia a foto do perfil dessa conta.
create or replace function public.client_avatar_from_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    select nullif(u.raw_user_meta_data->>'avatar_url', '') into new.avatar_url
      from auth.users u where u.id = new.user_id;
  end if;
  return new;
end $$;

create trigger clients_avatar_from_account
  before insert or update of user_id on public.clients
  for each row execute function public.client_avatar_from_account();

-- Ao salvar o perfil: nome, aniversário e foto passam para o cadastro em cada salão.
create or replace function public.sync_my_client_profile(p_name text, p_birthday date default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(nullif(trim(coalesce(p_name, '')), ''), 80);
  v_avatar text;
  v_count integer;
begin
  if auth.uid() is null then return 0; end if;
  if v_name is null or char_length(v_name) < 2 then return 0; end if;
  select nullif(raw_user_meta_data->>'avatar_url', '') into v_avatar from auth.users where id = auth.uid();
  update public.clients
     set name = v_name,
         birthday = coalesce(p_birthday, birthday),
         avatar_url = v_avatar
   where user_id = auth.uid()
     and (name is distinct from v_name
          or (p_birthday is not null and birthday is distinct from p_birthday)
          or avatar_url is distinct from v_avatar);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Clientes que já têm conta com foto
update public.clients c
   set avatar_url = nullif(u.raw_user_meta_data->>'avatar_url', '')
  from auth.users u
 where u.id = c.user_id
   and c.avatar_url is distinct from nullif(u.raw_user_meta_data->>'avatar_url', '');

-- A lista de clientes passa a trazer a foto (coluna nova no fim da view)
create or replace view public.client_stats with (security_invoker = true) as
 WITH visits AS (
         SELECT a.client_id, a.starts_at, a.price_cents, a.service_id
           FROM appointments a
          WHERE a.status = 'completed'::appointment_status OR a.status = 'confirmed'::appointment_status AND a.ends_at < now()
        ), agg AS (
         SELECT visits.client_id, count(*) AS visits, min(visits.starts_at) AS first_visit_at,
            max(visits.starts_at) AS last_visit_at, sum(visits.price_cents) AS total_spent_cents
           FROM visits
          GROUP BY visits.client_id
        ), last_service AS (
         SELECT DISTINCT ON (v.client_id) v.client_id, s.return_every_days
           FROM visits v
             JOIN services s ON s.id = v.service_id
          ORDER BY v.client_id, v.starts_at DESC
        ), calc AS (
         SELECT c_1.id, c_1.return_every_days AS by_client, ls.return_every_days AS by_service,
                CASE
                    WHEN agg_1.visits >= 2 THEN GREATEST(1, round(EXTRACT(epoch FROM agg_1.last_visit_at - agg_1.first_visit_at) / 86400.0 / (agg_1.visits - 1)::numeric)::integer)
                    ELSE NULL::integer
                END AS by_average
           FROM clients c_1
             LEFT JOIN agg agg_1 ON agg_1.client_id = c_1.id
             LEFT JOIN last_service ls ON ls.client_id = c_1.id
        )
 SELECT c.id AS client_id, c.salon_id, c.name, c.phone, c.birthday, c.notes, c.accepts_marketing, c.created_at,
    COALESCE(agg.visits, 0::bigint) AS visits, agg.first_visit_at, agg.last_visit_at,
    COALESCE(agg.total_spent_cents, 0::bigint) AS total_spent_cents,
    ( SELECT min(a.starts_at) AS min FROM appointments a
          WHERE a.client_id = c.id AND a.status = 'confirmed'::appointment_status AND a.starts_at > now()) AS next_appointment_at,
    ( SELECT count(*) AS count FROM appointments a
          WHERE a.client_id = c.id AND a.status = 'no_show'::appointment_status) AS no_shows,
    COALESCE(calc.by_client, calc.by_service, calc.by_average) AS return_every_days,
    c.return_every_days IS NOT NULL AS return_every_days_fixed,
        CASE
            WHEN calc.by_client IS NOT NULL THEN 'cliente'::text
            WHEN calc.by_service IS NOT NULL THEN 'servico'::text
            WHEN calc.by_average IS NOT NULL THEN 'media'::text
            ELSE NULL::text
        END AS return_source,
    c.avatar_url
   FROM clients c
     LEFT JOIN agg ON agg.client_id = c.id
     LEFT JOIN calc ON calc.id = c.id;

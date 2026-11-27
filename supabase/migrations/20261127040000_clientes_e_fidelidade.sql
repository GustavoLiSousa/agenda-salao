-- =====================================================================
-- Etapa 6: clientes como leads, fidelidade e configurações do salão
-- =====================================================================

-- Cartão fidelidade: a cada N visitas, o cliente ganha um prêmio
alter table public.salons
  add column loyalty_visits int check (loyalty_visits between 2 and 50),
  add column loyalty_reward text;

-- Visita = atendimento marcado como atendido OU horário confirmado que já passou
-- (muitos salões não marcam "atendido").
drop view if exists public.client_stats;
create view public.client_stats
with (security_invoker = true) as
with visits as (
  select a.client_id, a.starts_at, a.price_cents
    from public.appointments a
   where a.status = 'completed'
      or (a.status = 'confirmed' and a.ends_at < now())
),
agg as (
  select client_id,
         count(*)                         as visits,
         min(starts_at)                   as first_visit_at,
         max(starts_at)                   as last_visit_at,
         sum(price_cents)                 as total_spent_cents
    from visits
   group by client_id
)
select
  c.id as client_id,
  c.salon_id,
  c.name,
  c.phone,
  c.birthday,
  c.notes,
  c.accepts_marketing,
  c.created_at,
  coalesce(agg.visits, 0)            as visits,
  agg.first_visit_at,
  agg.last_visit_at,
  coalesce(agg.total_spent_cents, 0) as total_spent_cents,
  (select min(a.starts_at) from public.appointments a
    where a.client_id = c.id and a.status = 'confirmed' and a.starts_at > now()) as next_appointment_at,
  (select count(*) from public.appointments a
    where a.client_id = c.id and a.status = 'no_show')                         as no_shows,
  -- frequência: a combinada; senão a média real entre visitas
  coalesce(
    c.return_every_days,
    case when agg.visits >= 2 then
      greatest(1, round(extract(epoch from (agg.last_visit_at - agg.first_visit_at)) / 86400.0 / (agg.visits - 1))::int)
    end
  ) as return_every_days,
  c.return_every_days is not null as return_every_days_fixed
from public.clients c
left join agg on agg.client_id = c.id;

grant select on public.client_stats to authenticated;

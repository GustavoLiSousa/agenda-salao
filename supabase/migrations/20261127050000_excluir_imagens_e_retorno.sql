-- =====================================================================
-- Ajustes depois do primeiro teste:
--  * excluir profissional/serviço (arquiva quando já tem histórico)
--  * imagens: foto dos serviços, capa e logo do salão (bucket "imagens")
--  * retorno do cliente: o do cliente, senão o do último serviço, senão a média
-- =====================================================================

-- Arquivado = some do painel e do link, mas o histórico de atendimentos fica
alter table public.professionals add column if not exists archived_at timestamptz;
alter table public.services      add column if not exists archived_at timestamptz;

-- Imagens
alter table public.services add column if not exists image_url text;
alter table public.salons
  add column if not exists cover_url text,
  add column if not exists logo_url  text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Arquivos ficam em <salon_id>/...; só o dono do salão envia, troca ou apaga
create policy "imagens são públicas" on storage.objects
  for select using (bucket_id = 'imagens');
create policy "dono envia imagens do salão" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imagens' and public.is_salon_owner(((storage.foldername(name))[1])::uuid));
create policy "dono troca imagens do salão" on storage.objects
  for update to authenticated
  using (bucket_id = 'imagens' and public.is_salon_owner(((storage.foldername(name))[1])::uuid));
create policy "dono apaga imagens do salão" on storage.objects
  for delete to authenticated
  using (bucket_id = 'imagens' and public.is_salon_owner(((storage.foldername(name))[1])::uuid));

-- Retorno do cliente (mesmas colunas da etapa 6 + return_source no fim)
create or replace view public.client_stats
with (security_invoker = true) as
with visits as (
  select a.client_id, a.starts_at, a.price_cents, a.service_id
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
),
last_service as (
  select distinct on (v.client_id) v.client_id, s.return_every_days
    from visits v
    join public.services s on s.id = v.service_id
   order by v.client_id, v.starts_at desc
),
calc as (
  select c.id,
         c.return_every_days                                   as by_client,
         ls.return_every_days                                  as by_service,
         case when agg.visits >= 2 then
           greatest(1, round(extract(epoch from (agg.last_visit_at - agg.first_visit_at)) / 86400.0 / (agg.visits - 1))::int)
         end                                                   as by_average
    from public.clients c
    left join agg on agg.client_id = c.id
    left join last_service ls on ls.client_id = c.id
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
  coalesce(calc.by_client, calc.by_service, calc.by_average) as return_every_days,
  c.return_every_days is not null as return_every_days_fixed,
  case
    when calc.by_client  is not null then 'cliente'
    when calc.by_service is not null then 'servico'
    when calc.by_average is not null then 'media'
  end as return_source
from public.clients c
left join agg  on agg.client_id = c.id
left join calc on calc.id = c.id;

grant select on public.client_stats to authenticated;

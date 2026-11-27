-- Dados de exemplo para testar (rode depois da migração, no SQL Editor do Supabase).
-- Cria a "Barbearia do Zé" com 2 profissionais e alguns serviços.
-- O dono é ligado depois, quando você fizer login (próxima etapa).

insert into public.salons (id, slug, name, whatsapp, address)
values ('a0000000-0000-0000-0000-000000000001', 'barbearia-do-ze', 'Barbearia do Zé',
        '5511999999999', 'Rua Exemplo, 123 - Centro');

insert into public.professionals (id, salon_id, name, release_mode, release_weekday, release_time)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Zé', 'rolling', null, null),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Ana (manicure)', 'weekly', 1, '00:00');

insert into public.services (id, salon_id, name, category, price_cents, duration_min, return_every_days, sort_order)
values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Corte', 'Cabelo', 4000, 30, 21, 1),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Corte + barba', 'Cabelo', 6000, 45, 21, 2),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Progressiva', 'Cabelo', 15000, 120, 90, 3),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Mão e pé', 'Unhas', 5500, 75, 15, 4),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Design de sobrancelha', 'Sobrancelha', 3500, 30, 20, 5);

insert into public.professional_services (professional_id, service_id) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005');

-- Zé: terça a sábado, 9h-12h e 13h-19h (almoço 12h-13h)
insert into public.working_hours (professional_id, weekday, start_time, end_time)
select 'b0000000-0000-0000-0000-000000000001', d, t.s, t.e
from generate_series(2, 6) d,
     (values (time '09:00', time '12:00'), (time '13:00', time '19:00')) as t(s, e);

-- Ana: segunda a sexta, 10h-18h
insert into public.working_hours (professional_id, weekday, start_time, end_time)
select 'b0000000-0000-0000-0000-000000000002', d, '10:00', '18:00'
from generate_series(1, 5) d;

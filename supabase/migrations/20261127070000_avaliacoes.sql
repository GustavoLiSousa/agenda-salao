-- =====================================================================
-- Etapa: avaliações
--
-- Depois do atendimento marcado como "atendido", o cliente avalia o
-- profissional e o salão (1 a 5) pelo link pessoal do agendamento.
-- Só quem foi atendido avalia, uma vez por atendimento. O dono responde
-- e pode ocultar comentários ofensivos.
-- =====================================================================

create table public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  salon_id              uuid not null references public.salons(id) on delete cascade,
  appointment_id        uuid not null unique references public.appointments(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,
  professional_id       uuid not null references public.professionals(id) on delete cascade,
  salon_rating          smallint not null check (salon_rating between 1 and 5),
  professional_rating   smallint not null check (professional_rating between 1 and 5),
  comment               text check (char_length(comment) <= 600),
  reply                 text check (char_length(reply) <= 600),
  replied_at            timestamptz,
  hidden                boolean not null default false,
  created_at            timestamptz not null default now()
);
create index on public.reviews (salon_id, created_at desc);
create index on public.reviews (professional_id);

alter table public.reviews enable row level security;

-- O público lê pelas funções abaixo (sem expor o cliente); a equipe vê tudo.
create policy "equipe vê avaliações" on public.reviews
  for select using (public.is_salon_member(salon_id));
create policy "dono responde e oculta" on public.reviews
  for update using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

-- ---------------------------------------------------------------------
-- Cliente avalia pelo link pessoal do agendamento
-- ---------------------------------------------------------------------
create or replace function public.submit_review(
  p_token uuid,
  p_salon_rating int,
  p_professional_rating int,
  p_comment text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  select * into a from public.appointments where manage_token = p_token;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status <> 'completed' then raise exception 'Só dá para avaliar depois do atendimento'; end if;
  if a.starts_at < now() - interval '60 days' then raise exception 'O prazo para avaliar este atendimento acabou'; end if;
  if p_salon_rating not between 1 and 5 or p_professional_rating not between 1 and 5 then
    raise exception 'Escolha de 1 a 5 estrelas';
  end if;
  if char_length(v_comment) > 600 then raise exception 'Comentário muito longo (até 600 letras)'; end if;
  begin
    insert into public.reviews (salon_id, appointment_id, client_id, professional_id, salon_rating, professional_rating, comment)
    values (a.salon_id, a.id, a.client_id, a.professional_id, p_salon_rating, p_professional_rating, v_comment);
  exception when unique_violation then
    raise exception 'Este atendimento já foi avaliado. Obrigado!';
  end;
end $$;

-- Avaliação já feita para este link (para mostrar "obrigado")
create or replace function public.review_by_token(p_token uuid)
returns table (salon_rating smallint, professional_rating smallint, comment text, reply text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.salon_rating, r.professional_rating, r.comment, r.reply, r.created_at
    from public.reviews r
    join public.appointments a on a.id = r.appointment_id
   where a.manage_token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Vitrine pública: avaliações visíveis (só o primeiro nome do cliente)
-- ---------------------------------------------------------------------
create or replace function public.salon_reviews(p_salon uuid, p_limit int default 20)
returns table (
  id uuid,
  salon_rating smallint,
  professional_rating smallint,
  comment text,
  reply text,
  created_at timestamptz,
  client_first_name text,
  professional_id uuid,
  professional_name text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.salon_rating, r.professional_rating, r.comment, r.reply, r.created_at,
         nullif(split_part(trim(coalesce(c.name, '')), ' ', 1), ''),
         p.id, p.name
    from public.reviews r
    join public.clients c on c.id = r.client_id
    join public.professionals p on p.id = r.professional_id
   where r.salon_id = p_salon and not r.hidden
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 100);
$$;

-- Médias: uma linha para o salão (professional_id nulo) e uma por profissional
create or replace function public.salon_rating_summary(p_salon uuid)
returns table (professional_id uuid, average numeric, total int)
language sql stable security definer set search_path = public as $$
  select null::uuid, round(avg(salon_rating)::numeric, 1), count(*)::int
    from public.reviews where salon_id = p_salon and not hidden
  union all
  select professional_id, round(avg(professional_rating)::numeric, 1), count(*)::int
    from public.reviews where salon_id = p_salon and not hidden
   group by professional_id;
$$;

grant execute on function public.submit_review(uuid, int, int, text) to anon, authenticated;
grant execute on function public.review_by_token(uuid) to anon, authenticated;
grant execute on function public.salon_reviews(uuid, int) to anon, authenticated;
grant execute on function public.salon_rating_summary(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- "Meus agendamentos" passa a saber quais atendimentos já foram avaliados.
-- Função nova (v2) para não precisar apagar a antiga.
-- ---------------------------------------------------------------------
create or replace function public.my_appointments_v2()
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
  cancel_min_hours int,
  reviewed boolean
)
language sql stable security definer set search_path = public as $$
  select a.manage_token, a.status, a.starts_at, a.ends_at, a.price_cents,
         s.name, p.name, p.photo_url,
         sa.name, sa.slug, sa.logo_url, sa.whatsapp, sa.address, sa.timezone, sa.cancel_min_hours,
         exists (select 1 from public.reviews r where r.appointment_id = a.id)
    from public.clients c
    join public.appointments a on a.client_id = c.id
    join public.services s on s.id = a.service_id
    join public.professionals p on p.id = a.professional_id
    join public.salons sa on sa.id = a.salon_id
   where auth.uid() is not null and c.user_id = auth.uid()
   order by a.starts_at desc
   limit 300;
$$;
revoke execute on function public.my_appointments_v2() from public, anon;
grant execute on function public.my_appointments_v2() to authenticated;

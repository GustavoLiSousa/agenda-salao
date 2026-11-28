-- Comissão de cada profissional (em %), usada na tela de Relatórios.
-- Fica numa tabela separada porque a tabela de profissionais é pública (aparece no link do salão).
create table if not exists public.professional_commissions (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  pct numeric(5,2) not null check (pct >= 0 and pct <= 100),
  updated_at timestamptz not null default now()
);
create index if not exists professional_commissions_salon on public.professional_commissions (salon_id);
alter table public.professional_commissions enable row level security;

create policy "dono gerencia comissões" on public.professional_commissions
  for all to authenticated
  using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));
create policy "profissional vê a própria comissão" on public.professional_commissions
  for select to authenticated
  using (public.my_professional_id(salon_id) = professional_id or public.has_permission(salon_id, 'faturamento'));

create trigger audit_professional_commissions after insert or update or delete on public.professional_commissions
  for each row execute function public.audit_row();

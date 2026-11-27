-- Endereços usados pelo próprio site não podem virar link de salão
-- (mesma lista de src/lib/slug.ts).
alter table public.salons
  add constraint salons_slug_not_reserved
  check (slug not in ('entrar', 'sair', 'painel', 'auth', 'api', 'admin', 'app'));

alter table public.salons
  add constraint salons_slug_min_length check (char_length(slug) >= 3);

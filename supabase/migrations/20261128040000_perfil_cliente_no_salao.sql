-- Quando o cliente edita o perfil na Central do cliente, o nome (e o aniversário)
-- passam a valer também no cadastro dele em cada salão onde a conta está vinculada.
create or replace function public.sync_my_client_profile(p_name text, p_birthday date default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(nullif(trim(coalesce(p_name, '')), ''), 80);
  v_count integer;
begin
  if auth.uid() is null then return 0; end if;
  if v_name is null or char_length(v_name) < 2 then return 0; end if;
  update public.clients
     set name = v_name,
         birthday = coalesce(p_birthday, birthday)
   where user_id = auth.uid()
     and (name is distinct from v_name or (p_birthday is not null and birthday is distinct from p_birthday));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.sync_my_client_profile(text, date) from public, anon;
grant execute on function public.sync_my_client_profile(text, date) to authenticated;

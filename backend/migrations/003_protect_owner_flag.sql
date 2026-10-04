-- Only trusted server operations or database administrators may assign owner status.
create or replace function public.prevent_untrusted_owner_flag_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is not null
    and auth.role() not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.owner is true then
        raise exception 'Only trusted operations may change owner status';
      end if;
    elsif new.owner is distinct from old.owner then
      raise exception 'Only trusted operations may change owner status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_utenti_owner_flag on public.utenti;
create trigger protect_utenti_owner_flag
before insert or update on public.utenti
for each row
execute function public.prevent_untrusted_owner_flag_change();
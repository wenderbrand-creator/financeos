-- Finance OS — 0003: self-service account deletion (LGPD art. 18, VI)
-- Run AFTER 0002, once, in Supabase Dashboard → SQL Editor. Re-runnable.
-- It creates a function only. Nothing is deleted when you run this file:
-- deletion happens only when a signed-in user calls the function for THEIR OWN account
-- (the app asks for the password again before calling it).
--
-- Deleting the auth user cascades to user_settings, transactions, user_usage and audit_log
-- (all reference auth.users ON DELETE CASCADE). Sessions and identities are removed by Supabase Auth.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

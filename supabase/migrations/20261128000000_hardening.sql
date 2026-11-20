-- Module 9A: hardening
-- 1. Staff sign-ins (after the authenticator code) go into the activity log.
-- 2. A check the access test uses to find every table and whether its
--    protection rules (RLS) are on, so a new unprotected table fails the tests.

create function public.log_staff_sign_in()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  insert into public.audit_log (actor_id, actor_role, entity_type, entity_id, action)
  values (auth.uid(), public.audit_actor_role(), 'profiles', auth.uid(), 'sign_in');
end $$;
revoke execute on function public.log_staff_sign_in from public, anon;
grant execute on function public.log_staff_sign_in to authenticated;

-- For the automated tests only (service key); nobody signed in can call it.
create function public.table_security()
returns table (table_name text, rls_enabled boolean)
language sql stable security definer set search_path = '' as $$
  select c.relname::text, c.relrowsecurity
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  order by 1;
$$;
revoke execute on function public.table_security from public, anon, authenticated;
grant execute on function public.table_security to service_role;

-- The activity log screen filters by date and person.
create index audit_log_time_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);

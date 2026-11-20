-- Module 0: Foundation
-- Tables: profiles, organizations, organization_members, audit_log
-- Helpers: is_staff(), staff_role(), is_org_member(org), is_org_owner(org)
-- Every table has Row Level Security (RLS) switched on.

-- ---------------------------------------------------------------
-- 1. Allowed values
-- ---------------------------------------------------------------
create type public.staff_role as enum ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR', 'CONSULTANT');
create type public.client_role as enum ('CLIENT_OWNER', 'CLIENT_MEMBER');
create type public.membership_status as enum ('invited', 'active', 'revoked');
create type public.organization_status as enum ('prospect', 'active', 'inactive');

-- Keeps updated_at current on every table that has it.
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  staff_role  public.staff_role,          -- null = not Atlas staff
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  legal_name  text,
  tax_id      text,
  address     text,
  status      public.organization_status not null default 'prospect',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  role             public.client_role not null,
  status           public.membership_status not null default 'invited',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.audit_log (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  actor_id         uuid,
  actor_role       text,
  organization_id  uuid,
  entity_type      text not null,
  entity_id        uuid,
  action           text not null,
  from_status      text,
  to_status        text,
  metadata         jsonb not null default '{}'::jsonb
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_org_idx on public.audit_log (organization_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- 3. Permission helpers
-- "security definer" lets them read profiles/memberships without
-- tripping over the RLS rules that call them (avoids infinite loops).
-- ---------------------------------------------------------------

-- Staff only count as staff once they have passed MFA (aal2).
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.staff_role is not null and p.is_active
     );
$$;

create function public.staff_role() returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select p.staff_role from public.profiles p
  where p.id = auth.uid() and p.is_active
    and coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = org and m.user_id = auth.uid()
      and m.status = 'active' and p.is_active
  );
$$;

create function public.is_org_owner(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = org and m.user_id = auth.uid()
      and m.status = 'active' and m.role = 'CLIENT_OWNER' and p.is_active
  );
$$;

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_log            enable row level security;

-- Visitors who are not logged in get nothing from these tables.
revoke all on public.profiles, public.organizations, public.organization_members, public.audit_log from anon;
-- RLS does not apply to TRUNCATE (wipe whole table), so remove that right explicitly.
revoke truncate on public.profiles, public.organizations, public.organization_members, public.audit_log from authenticated;

-- profiles: see yourself; staff see everyone.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

-- Users may edit only their name and phone, never their role or active flag.
-- Column-level grant: even a valid RLS match cannot touch other columns.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members see their own; staff see all.
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_staff() or public.is_org_member(id));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'));
create policy organizations_update on public.organizations for update to authenticated
  using (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'))
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'));
revoke delete on public.organizations from authenticated;

-- organization_members: members see co-members of their org; staff see all.
-- Client owners inviting members arrives in Module 3 via server code.
create policy members_select on public.organization_members for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));
create policy members_insert on public.organization_members for insert to authenticated
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'));
create policy members_update on public.organization_members for update to authenticated
  using (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'))
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'));
revoke delete on public.organization_members from authenticated; -- revoke = set status 'revoked'

-- audit_log: only SUPER_ADMIN and ADMIN may read. Nobody writes directly.
create policy audit_select on public.audit_log for select to authenticated
  using (public.staff_role() in ('SUPER_ADMIN', 'ADMIN'));
revoke insert, update, delete, truncate on public.audit_log from authenticated, service_role;

-- ---------------------------------------------------------------
-- 5. Audit log: append-only, written by triggers
-- ---------------------------------------------------------------
create function public.audit_actor_role() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then 'system'
    else coalesce((select p.staff_role::text from public.profiles p where p.id = auth.uid()), 'client')
  end;
$$;

-- Blocks edits and deletes for everyone, including admins and the service key.
create function public.audit_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- Generic: any table with a "status" column logs status changes automatically.
create function public.audit_status_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  org := case when tg_table_name = 'organizations' then new.id
              else (to_jsonb(new) ->> 'organization_id')::uuid end;
  insert into public.audit_log (actor_id, actor_role, organization_id, entity_type, entity_id,
                                action, from_status, to_status)
  values (auth.uid(), public.audit_actor_role(), org, tg_table_name, new.id,
          lower(tg_op), case when tg_op = 'UPDATE' then old.status::text end, new.status::text);
  return new;
end $$;

create trigger organizations_audit after insert or update on public.organizations
  for each row execute function public.audit_status_change();
create trigger organization_members_audit after insert or update on public.organization_members
  for each row execute function public.audit_status_change();

-- Staff role and active-flag changes are always logged.
create function public.audit_profile_access_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.staff_role is distinct from new.staff_role or old.is_active is distinct from new.is_active then
    insert into public.audit_log (actor_id, actor_role, entity_type, entity_id, action, metadata)
    values (auth.uid(), public.audit_actor_role(), 'profiles', new.id, 'access_change',
            jsonb_build_object(
              'from_role', old.staff_role, 'to_role', new.staff_role,
              'from_active', old.is_active, 'to_active', new.is_active));
  end if;
  return new;
end $$;
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_profile_access_change();

-- ---------------------------------------------------------------
-- 6. New login -> profile row
-- ---------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger-only functions should not be callable through the API.
revoke execute on function public.handle_new_user, public.audit_status_change,
  public.audit_profile_access_change, public.audit_log_immutable
  from public, anon, authenticated;

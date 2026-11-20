-- Module 3: client portal
-- Notifications, colleagues (add/revoke members), seeing co-members' names,
-- and a safe engagement overview for clients.

-- ---------------------------------------------------------------
-- 1. Notifications: each person sees only their own
-- ---------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text check (link like '/%'),   -- in-app paths only, never outside links
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;  -- only "mark as read"
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notifications are only ever created by these triggers (security definer).
create function public.notify_new_inquiry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'web_form' then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'inquiry_new', 'New inquiry ' || new.reference, new.company_name, '/admin/inquiries/' || new.id
    from public.profiles p
    where p.is_active and p.staff_role in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR');
  end if;
  return new;
end $$;
create trigger inquiries_notify_new after insert on public.inquiries
  for each row execute function public.notify_new_inquiry();

create function public.notify_inquiry_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is distinct from auth.uid() then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.assigned_to, 'inquiry_assigned', 'Inquiry assigned to you: ' || new.reference,
            new.company_name, '/admin/inquiries/' || new.id);
  end if;
  return new;
end $$;
create trigger inquiries_notify_assigned after update of assigned_to on public.inquiries
  for each row execute function public.notify_inquiry_assigned();

create function public.notify_member_welcome() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into public.notifications (user_id, type, title, body, link)
    select new.user_id, 'portal_welcome', 'Welcome to the Atlas Advisory portal',
           'You now have access to ' || o.name || '.', '/portal'
    from public.organizations o where o.id = new.organization_id;
  end if;
  return new;
end $$;
create trigger members_notify_welcome after insert or update of status on public.organization_members
  for each row execute function public.notify_member_welcome();

-- ---------------------------------------------------------------
-- 2. Clients may see the names of people in their own organization(s)
-- ---------------------------------------------------------------
create function public.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = p_user
  );
$$;
create policy profiles_coworkers_select on public.profiles for select to authenticated
  using (public.shares_org_with(id));

-- ---------------------------------------------------------------
-- 3. Add / revoke colleagues (owner of that organization, or coordinator+ staff)
-- ---------------------------------------------------------------
create function public.add_org_member(p_org uuid, p_user uuid, p_role public.client_role)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_org_owner(p_org) or public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR')) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = p_user and staff_role is not null) then
    raise exception 'user_is_staff' using errcode = 'P0001';
  end if;
  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_org, p_user, p_role, 'active')
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
end $$;

create function public.revoke_org_member(p_org uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_org_owner(p_org) or public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR')) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_remove_self' using errcode = 'P0001';
  end if;
  update public.organization_members set status = 'revoked'
  where organization_id = p_org and user_id = p_user and status <> 'revoked';
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.organization_members
                 where organization_id = p_org and role = 'CLIENT_OWNER' and status = 'active') then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
end $$;

revoke execute on function public.add_org_member, public.revoke_org_member from public, anon;
grant execute on function public.add_org_member, public.revoke_org_member to authenticated;

-- ---------------------------------------------------------------
-- 4. Engagement overview for the client dashboard
-- Clients cannot read inquiries (staff-only), so this returns only the safe
-- parts: the stage, the services, and the Atlas contact person.
-- ---------------------------------------------------------------
create function public.org_overview(p_org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_org_member(p_org) or public.is_staff() then (
    select jsonb_build_object(
      'stage', i.status,
      'services', coalesce((select jsonb_agg(s.name order by s.sort_order)
                            from public.inquiry_services x join public.services s on s.id = x.service_id
                            where x.inquiry_id = i.id), '[]'::jsonb),
      'contact_name', p.full_name,
      'contact_role', p.staff_role
    )
    from public.organizations o
    left join public.inquiries i on i.id = o.source_inquiry_id
    left join public.profiles p on p.id = i.assigned_to and p.is_active
    where o.id = p_org
  ) end;
$$;
revoke execute on function public.org_overview from public, anon;
grant execute on function public.org_overview to authenticated;

revoke execute on function public.notify_new_inquiry, public.notify_inquiry_assigned, public.notify_member_welcome
  from public, anon, authenticated;

-- Fix: in the permission checks, staff_role() is NULL for clients, which made
-- "not (false or NULL)" evaluate to NULL, and IF NULL does not raise. Any
-- logged-in client could therefore add/revoke members of any organization.
-- coalesce(..., false) turns "unknown" into a firm "no".

create or replace function public.add_org_member(p_org uuid, p_user uuid, p_role public.client_role)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_org_owner(p_org)
                  or public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = p_user and staff_role is not null) then
    raise exception 'user_is_staff' using errcode = 'P0001';
  end if;
  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_org, p_user, p_role, 'active')
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
end $$;

create or replace function public.revoke_org_member(p_org uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_org_owner(p_org)
                  or public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false) then
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

-- Same hardening for convert_inquiry (Module 2), which already had an explicit
-- "is null" guard; rewritten in the same style so the pattern is consistent.
create or replace function public.convert_inquiry(p_inquiry_id uuid, p_client_user_id uuid, p_org_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_inquiry public.inquiries;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  select * into v_inquiry from public.inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'inquiry_not_found' using errcode = 'P0001'; end if;
  if v_inquiry.organization_id is not null then raise exception 'already_converted' using errcode = 'P0001'; end if;
  if v_inquiry.status in ('not_a_fit', 'spam') then raise exception 'inquiry_closed' using errcode = 'P0001'; end if;

  insert into public.organizations (name, status, source_inquiry_id)
  values (trim(p_org_name), 'prospect', p_inquiry_id)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, p_client_user_id, 'CLIENT_OWNER', 'active');

  update public.consultations set organization_id = v_org where inquiry_id = p_inquiry_id;
  update public.inquiries set organization_id = v_org, status = 'pre_assessment' where id = p_inquiry_id;
  return v_org;
end $$;

-- Notification links must be in-app paths: "/x" yes, "//other-site.com" no.
alter table public.notifications drop constraint notifications_link_check;
alter table public.notifications add constraint notifications_link_check check (link ~ '^/[^/\\]');

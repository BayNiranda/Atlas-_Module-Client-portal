-- Module 2: admin leads
-- Inquiry pipeline stages, WhatsApp leads, consultations, internal notes,
-- converting an inquiry into a client organization, staff role management.

-- ---------------------------------------------------------------
-- 1. Inquiry pipeline stages (owner's prototype)
-- ---------------------------------------------------------------
create type public.inquiry_stage as enum
  ('new', 'discussion', 'consultation', 'pre_assessment', 'proposal', 'agreement', 'won', 'not_a_fit', 'spam');

alter table public.inquiries alter column status drop default;
alter table public.inquiries alter column status type public.inquiry_stage using (
  case status::text
    when 'new' then 'new' when 'spam' then 'spam' when 'disqualified' then 'not_a_fit'
    when 'converted' then 'pre_assessment' else 'discussion'
  end)::public.inquiry_stage;
alter table public.inquiries alter column status set default 'new';
drop type public.inquiry_status;

-- ---------------------------------------------------------------
-- 2. Inquiry columns for manual leads, qualification and conversion
-- ---------------------------------------------------------------
alter table public.organizations add column source_inquiry_id uuid references public.inquiries (id);

alter table public.inquiries
  add column qualification text check (qualification in ('low', 'medium', 'high', 'outside')),
  add column organization_id uuid references public.organizations (id),
  add column created_by uuid references public.profiles (id),
  add constraint inquiries_source_check check (source in ('web_form', 'whatsapp', 'referral', 'other'));

-- WhatsApp leads may have no email yet and a short description; web forms still require both.
alter table public.inquiries alter column email drop not null;
alter table public.inquiries alter column industry drop not null;
alter table public.inquiries drop constraint inquiries_challenge_check;
alter table public.inquiries add constraint inquiries_challenge_check check (length(challenge) between 1 and 4000);
alter table public.inquiries add constraint inquiries_web_form_fields
  check (source <> 'web_form' or (email is not null and industry is not null and length(challenge) >= 10));

-- Staff (not consultants) may log leads that arrived on WhatsApp, as themselves.
grant insert on public.inquiries, public.inquiry_services to authenticated;
grant usage on sequence public.inquiry_ref_seq to authenticated;
create policy inquiries_staff_insert on public.inquiries for insert to authenticated
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR')
              and created_by = auth.uid() and source <> 'web_form');
create policy inquiry_services_staff_insert on public.inquiry_services for insert to authenticated
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'));

-- ---------------------------------------------------------------
-- 3. Consultations (staff-only; every staff role may schedule/record)
-- ---------------------------------------------------------------
create type public.consultation_mode as enum ('in_person', 'online', 'phone');
create type public.consultation_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');

create table public.consultations (
  id               uuid primary key default gen_random_uuid(),
  inquiry_id       uuid not null references public.inquiries (id) on delete cascade,
  organization_id  uuid references public.organizations (id),
  consultant_id    uuid not null references public.profiles (id),
  scheduled_at     timestamptz not null,
  mode             public.consultation_mode not null,
  location         text check (length(location) <= 300),
  status           public.consultation_status not null default 'scheduled',
  created_by       uuid not null default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index consultations_inquiry_idx on public.consultations (inquiry_id);
create index consultations_upcoming_idx on public.consultations (scheduled_at) where status = 'scheduled';
create trigger consultations_updated_at before update on public.consultations
  for each row execute function public.set_updated_at();
create trigger consultations_audit after insert or update on public.consultations
  for each row execute function public.audit_status_change();

alter table public.consultations enable row level security;
revoke all on public.consultations from anon;
revoke delete, truncate on public.consultations from authenticated;
create policy consultations_staff_select on public.consultations for select to authenticated
  using (public.is_staff());
create policy consultations_staff_insert on public.consultations for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());
create policy consultations_staff_update on public.consultations for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------
-- 4. Internal notes: staff-only, append-only (no edits, no deletes)
-- ---------------------------------------------------------------
create table public.internal_notes (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('inquiry', 'organization', 'consultation')),
  entity_id    uuid not null,
  body         text not null check (length(trim(body)) between 1 and 5000),
  author_id    uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index internal_notes_entity_idx on public.internal_notes (entity_type, entity_id, created_at);

alter table public.internal_notes enable row level security;
revoke all on public.internal_notes from anon;
revoke update, delete, truncate on public.internal_notes from authenticated;
create policy notes_staff_select on public.internal_notes for select to authenticated
  using (public.is_staff());
create policy notes_staff_insert on public.internal_notes for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());

-- ---------------------------------------------------------------
-- 5. Convert an inquiry into a client organization (one step, all or nothing)
-- Called by the staff member's own session, so the audit log records who did it.
-- The client's login is created first by server code (auth admin API).
-- ---------------------------------------------------------------
create function public.convert_inquiry(p_inquiry_id uuid, p_client_user_id uuid, p_org_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_inquiry public.inquiries;
begin
  if public.staff_role() not in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR') or public.staff_role() is null then
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
revoke execute on function public.convert_inquiry from public, anon;
grant execute on function public.convert_inquiry to authenticated;

-- ---------------------------------------------------------------
-- 6. Staff role management (SUPER_ADMIN only)
-- profiles.staff_role cannot be edited directly (column grant), only here.
-- ---------------------------------------------------------------
create function public.set_staff_access(p_user_id uuid, p_role public.staff_role, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_remaining int;
begin
  if public.staff_role() is distinct from 'SUPER_ADMIN' then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_self' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organization_members where user_id = p_user_id) then
    raise exception 'user_is_client' using errcode = 'P0001';
  end if;

  update public.profiles set staff_role = p_role, is_active = p_active where id = p_user_id;
  if not found then raise exception 'user_not_found' using errcode = 'P0001'; end if;

  select count(*) into v_remaining from public.profiles where staff_role = 'SUPER_ADMIN' and is_active;
  if v_remaining = 0 then
    raise exception 'last_super_admin' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.set_staff_access from public, anon;
grant execute on function public.set_staff_access to authenticated;

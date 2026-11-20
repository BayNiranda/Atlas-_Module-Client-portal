-- Module 6: agreements, signed by scan
-- The agreement is prepared from an accepted proposal, issued (locked), printed,
-- signed and sealed, and the scans uploaded. An Admin confirms "Signed" only
-- once the fully signed file is stored; then everything is locked for good.

create type public.agreement_status as enum ('draft', 'issued', 'client_signed', 'signed', 'voided', 'superseded');

create sequence public.agreement_number_seq;

create table public.agreements (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id),
  proposal_id          uuid not null references public.proposals (id),
  number               text not null default 'AGR-' || to_char(now() at time zone 'Asia/Vientiane', 'YYMM') || '-'
                                                 || lpad(nextval('public.agreement_number_seq')::text, 4, '0'),
  version              int not null default 1 check (version >= 1),
  supersedes_id        uuid references public.agreements (id),
  title                text not null check (length(trim(title)) between 1 and 200),
  start_date           date not null,
  end_date             date not null check (end_date >= start_date),
  content              jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) < 500000),
  status               public.agreement_status not null default 'draft',
  created_by           uuid not null default auth.uid() references public.profiles (id),
  issued_at            timestamptz,
  issued_by            uuid references public.profiles (id),
  client_file_path     text,
  client_file_name     text,
  client_file_sha256   text check (client_file_sha256 ~ '^[0-9a-f]{64}$'),
  client_uploaded_at   timestamptz,
  client_uploaded_by   uuid references public.profiles (id),
  signed_file_path     text,
  signed_file_name     text,
  signed_file_sha256   text check (signed_file_sha256 ~ '^[0-9a-f]{64}$'),
  signed_uploaded_at   timestamptz,
  signed_uploaded_by   uuid references public.profiles (id),
  confirmed_at         timestamptz,
  confirmed_by         uuid references public.profiles (id),
  voided_at            timestamptz,
  voided_by            uuid references public.profiles (id),
  void_reason          text check (length(void_reason) <= 2000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (number, version)
);
create index agreements_org_idx on public.agreements (organization_id, created_at desc);
create trigger agreements_updated_at before update on public.agreements
  for each row execute function public.set_updated_at();
create trigger agreements_audit after insert or update on public.agreements
  for each row execute function public.audit_status_change();

-- Locks (apply to everyone, including the service key):
--  * after "draft", the text can never change;
--  * an uploaded file's record can never be replaced or removed;
--  * a signed agreement can only move to "superseded".
create function public.agreement_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.organization_id, new.proposal_id, new.number, new.version, new.supersedes_id,
       new.title, new.start_date, new.end_date, new.content)
     is distinct from (old.organization_id, old.proposal_id, old.number, old.version, old.supersedes_id,
       old.title, old.start_date, old.end_date, old.content) then
    raise exception 'agreement_locked' using errcode = 'P0001';
  end if;
  if old.client_file_path is not null and (new.client_file_path, new.client_file_sha256, new.client_file_name)
       is distinct from (old.client_file_path, old.client_file_sha256, old.client_file_name) then
    raise exception 'agreement_file_locked' using errcode = 'P0001';
  end if;
  if old.signed_file_path is not null and (new.signed_file_path, new.signed_file_sha256, new.signed_file_name)
       is distinct from (old.signed_file_path, old.signed_file_sha256, old.signed_file_name) then
    raise exception 'agreement_file_locked' using errcode = 'P0001';
  end if;
  if old.status = 'signed' and new.status not in ('signed', 'superseded') then
    raise exception 'agreement_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger agreements_lock before update on public.agreements
  for each row execute function public.agreement_lock();

-- A signed agreement can never be deleted; others only as drafts (by RLS below).
create function public.agreement_no_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' then raise exception 'agreement_locked' using errcode = 'P0001'; end if;
  return old;
end $$;
create trigger agreements_no_delete before delete on public.agreements
  for each row execute function public.agreement_no_delete();

alter table public.agreements enable row level security;
revoke all on public.agreements from anon;
revoke insert, update, delete, truncate on public.agreements from authenticated;
-- Staff edit only a draft's text. Everything else goes through the functions below.
grant update (title, start_date, end_date, content) on public.agreements to authenticated;
grant delete on public.agreements to authenticated;

create policy agreements_select on public.agreements for select to authenticated
  using (public.is_staff() or (public.is_org_member(organization_id) and status <> 'draft'));
create policy agreements_staff_update on public.agreements for update to authenticated
  using (public.is_staff() and status = 'draft') with check (public.is_staff() and status = 'draft');
create policy agreements_staff_delete on public.agreements for delete to authenticated
  using (public.is_staff() and status = 'draft');

-- ---------------------------------------------------------------
-- Private file storage. No storage rules for users at all: files are only
-- written and read by the server, after the checks in the app and below.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agreements', 'agreements', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Prepare (any staff): from an accepted proposal. Content is built by the app
-- from the standard template and the proposal.
-- ---------------------------------------------------------------
create function public.prepare_agreement(p_proposal uuid, p_title text, p_start date, p_end date, p_content jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_prop public.proposals;
  v_id uuid;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into v_prop from public.proposals where id = p_proposal;
  if not found or v_prop.status <> 'accepted' then raise exception 'proposal_not_accepted' using errcode = 'P0001'; end if;

  -- One live agreement per accepted proposal: reuse an open one.
  select id into v_id from public.agreements
  where proposal_id = p_proposal and status in ('draft', 'issued', 'client_signed', 'signed')
  order by version desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.agreements (organization_id, proposal_id, title, start_date, end_date, content, created_by)
  values (v_prop.organization_id, p_proposal, p_title, p_start, p_end, p_content, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------
-- Issue for signing (Admin / Super admin): locks the text
-- ---------------------------------------------------------------
create function public.issue_agreement(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.agreements;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.agreements where id = p_id for update;
  if not found or v.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  update public.agreements set status = 'issued', issued_at = now(), issued_by = auth.uid() where id = p_id;
  perform public.notify_org_members(v.organization_id, 'agreement_issued',
    'Agreement ready to sign: ' || v.title,
    v.number || ' v' || v.version || '. Print it, sign and stamp it, then upload the scan in the portal.',
    '/portal/agreements/' || p_id);
end $$;

-- ---------------------------------------------------------------
-- Record an uploaded file (the server stores the file first, then calls this
-- as the signed-in person, so these checks decide whether it counts).
--   kind 'client': the client-signed scan — client owner of that company, or staff
--   kind 'signed': the fully signed copy (both parties) — staff only
-- ---------------------------------------------------------------
create function public.record_agreement_file(p_id uuid, p_kind text, p_path text, p_name text, p_sha256 text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.agreements;
begin
  select * into v from public.agreements where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  -- The file must sit in this company's and this agreement's own folder.
  if p_path not like v.organization_id || '/' || v.id || '/%' then raise exception 'bad_path' using errcode = 'P0001'; end if;

  if p_kind = 'client' then
    if not (coalesce(public.is_org_owner(v.organization_id), false) or coalesce(public.is_staff(), false)) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    if v.status <> 'issued' or v.client_file_path is not null then raise exception 'not_open' using errcode = 'P0001'; end if;
    update public.agreements
    set client_file_path = p_path, client_file_name = left(p_name, 200), client_file_sha256 = p_sha256,
        client_uploaded_at = now(), client_uploaded_by = auth.uid(), status = 'client_signed'
    where id = p_id;

    insert into public.notifications (user_id, type, title, body, link)
    select distinct p.id, 'agreement_client_signed', 'Client signed: ' || v.number || ' v' || v.version,
           o.name || ' uploaded the signed agreement. Countersign and upload the fully signed copy.', '/admin/agreements/' || p_id
    from public.organizations o
    left join public.inquiries i on i.id = o.source_inquiry_id
    join public.profiles p on p.is_active and p.staff_role is not null
         and (p.id = i.assigned_to or p.staff_role in ('SUPER_ADMIN', 'ADMIN'))
    where o.id = v.organization_id;

  elsif p_kind = 'signed' then
    if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
    if v.status not in ('issued', 'client_signed') or v.signed_file_path is not null then
      raise exception 'not_open' using errcode = 'P0001';
    end if;
    update public.agreements
    set signed_file_path = p_path, signed_file_name = left(p_name, 200), signed_file_sha256 = p_sha256,
        signed_uploaded_at = now(), signed_uploaded_by = auth.uid()
    where id = p_id;
  else
    raise exception 'bad_kind' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------
-- Confirm "Signed" (Admin / Super admin), only with the fully signed file stored
-- ---------------------------------------------------------------
create function public.confirm_agreement_signed(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.agreements;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.agreements where id = p_id for update;
  if not found or v.status not in ('issued', 'client_signed') then raise exception 'not_open' using errcode = 'P0001'; end if;
  if v.signed_file_path is null then raise exception 'signed_file_missing' using errcode = 'P0001'; end if;

  -- An earlier signed version is replaced by this amendment.
  update public.agreements set status = 'superseded' where number = v.number and id <> p_id and status = 'signed';
  update public.agreements set status = 'signed', confirmed_at = now(), confirmed_by = auth.uid() where id = p_id;

  perform public.advance_inquiry_stage(v.organization_id, 'won');
  perform public.notify_org_members(v.organization_id, 'agreement_signed',
    'Agreement signed: ' || v.title, 'The fully signed copy is available to download in the portal.', '/portal/agreements/' || p_id);
end $$;

-- ---------------------------------------------------------------
-- Void (Admin / Super admin) an agreement that is not yet signed
-- ---------------------------------------------------------------
create function public.void_agreement(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.agreements;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into v from public.agreements where id = p_id for update;
  if not found or v.status not in ('issued', 'client_signed') then raise exception 'not_open' using errcode = 'P0001'; end if;
  update public.agreements set status = 'voided', voided_at = now(), voided_by = auth.uid(), void_reason = left(trim(p_reason), 2000)
  where id = p_id;
  perform public.notify_org_members(v.organization_id, 'agreement_voided',
    'Agreement cancelled: ' || v.title, left(trim(p_reason), 300), '/portal/agreements/' || p_id);
end $$;

-- ---------------------------------------------------------------
-- New version (any staff): an amendment or a corrected re-issue, as a draft
-- ---------------------------------------------------------------
create function public.new_agreement_version(p_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.agreements;
  v_new uuid;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into v from public.agreements where id = p_id;
  if not found or v.status not in ('issued', 'client_signed', 'signed', 'voided') then
    raise exception 'cannot_revise' using errcode = 'P0001';
  end if;
  select id into v_new from public.agreements where number = v.number and status = 'draft';
  if v_new is not null then return v_new; end if;

  insert into public.agreements (organization_id, proposal_id, number, version, supersedes_id, title, start_date, end_date, content, created_by)
  select v.organization_id, v.proposal_id, v.number, max(x.version) + 1, v.id, v.title, v.start_date, v.end_date, v.content, auth.uid()
  from public.agreements x where x.number = v.number
  returning id into v_new;
  return v_new;
end $$;

revoke execute on function public.prepare_agreement, public.issue_agreement, public.record_agreement_file,
  public.confirm_agreement_signed, public.void_agreement, public.new_agreement_version from public, anon;
grant execute on function public.prepare_agreement, public.issue_agreement, public.record_agreement_file,
  public.confirm_agreement_signed, public.void_agreement, public.new_agreement_version to authenticated;
revoke execute on function public.agreement_lock, public.agreement_no_delete from public, anon, authenticated;

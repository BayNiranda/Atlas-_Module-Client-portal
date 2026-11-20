-- Module 7: documents
-- Atlas requests documents; clients upload them after an agreement is signed;
-- staff review, share reports, and keep internal files. Files go straight to
-- private storage with a one-time permission; the server then checks them
-- and records them through the functions below. Every download is logged.

create type public.document_category as enum
  ('registration_legal', 'tax', 'bank_statements', 'financial_statements', 'payroll', 'contracts', 'atlas_reports', 'other');
create type public.document_request_status as enum ('open', 'fulfilled', 'cancelled');
create type public.document_status as enum ('received', 'accepted', 'rejected');
create type public.document_visibility as enum ('client', 'internal');

create table public.document_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id),
  title            text not null check (length(trim(title)) between 1 and 200),
  category         public.document_category not null default 'other',
  note             text check (length(note) <= 2000),
  due_date         date,
  status           public.document_request_status not null default 'open',
  requested_by     uuid not null default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index document_requests_org_idx on public.document_requests (organization_id, status);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id),
  request_id       uuid references public.document_requests (id),
  category         public.document_category not null default 'other',
  file_name        text not null check (length(file_name) between 1 and 200),
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path     text not null unique,
  visibility       public.document_visibility not null default 'client',
  status           public.document_status not null default 'received',
  review_note      text check (length(review_note) <= 2000),
  reviewed_by      uuid references public.profiles (id),
  reviewed_at      timestamptz,
  uploaded_by      uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index documents_org_idx on public.documents (organization_id, created_at desc);
create index documents_review_idx on public.documents (status) where status = 'received';

create trigger document_requests_updated_at before update on public.document_requests
  for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger document_requests_audit after insert or update on public.document_requests
  for each row execute function public.audit_status_change();
create trigger documents_audit after insert or update on public.documents
  for each row execute function public.audit_status_change();

-- A recorded file never changes: only its review fields may.
create function public.document_file_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.organization_id, new.file_name, new.mime_type, new.size_bytes, new.sha256, new.storage_path, new.uploaded_by, new.visibility)
     is distinct from (old.organization_id, old.file_name, old.mime_type, old.size_bytes, old.sha256, old.storage_path, old.uploaded_by, old.visibility) then
    raise exception 'document_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger documents_file_lock before update on public.documents
  for each row execute function public.document_file_lock();
create function public.document_no_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'document_locked' using errcode = 'P0001';
end $$;
create trigger documents_no_delete before delete on public.documents
  for each row execute function public.document_no_delete();

-- RLS: no direct writes at all; everything goes through the functions below.
alter table public.document_requests enable row level security;
alter table public.documents enable row level security;
revoke all on public.document_requests, public.documents from anon;
revoke insert, update, delete, truncate on public.document_requests, public.documents from authenticated;

create policy document_requests_select on public.document_requests for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));
-- Internal documents are never visible to clients.
create policy documents_select on public.documents for select to authenticated
  using (public.is_staff() or (public.is_org_member(organization_id) and visibility = 'client'));

-- Private bucket (no storage rules for users: only the server touches it).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array[
  'application/pdf', 'image/jpeg', 'image/png', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Who may upload? Staff always; client members of the company only once
-- an agreement is signed (owner's rule: documents after the engagement).
-- Internal uploads: staff only. A request must be open and the company's own.
-- Raises if not allowed; used before the upload starts and when recording.
-- ---------------------------------------------------------------
create function public.authorize_document_upload(p_org uuid, p_request uuid, p_visibility public.document_visibility)
returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.is_staff(), false) then
    null;
  elsif coalesce(public.is_org_member(p_org), false) then
    if p_visibility = 'internal' then raise exception 'not_allowed' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.agreements where organization_id = p_org and status in ('signed', 'superseded')) then
      raise exception 'no_signed_agreement' using errcode = 'P0001';
    end if;
  else
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_request is not null and not exists (
    select 1 from public.document_requests where id = p_request and organization_id = p_org and status = 'open'
  ) then
    raise exception 'request_not_open' using errcode = 'P0001';
  end if;
end $$;

create function public.record_document(
  p_org uuid, p_request uuid, p_category public.document_category, p_visibility public.document_visibility,
  p_path text, p_name text, p_mime text, p_size bigint, p_sha256 text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_org_name text;
begin
  perform public.authorize_document_upload(p_org, p_request, p_visibility);
  if p_path not like p_org || '/%' then raise exception 'bad_path' using errcode = 'P0001'; end if;

  insert into public.documents (organization_id, request_id, category, file_name, mime_type, size_bytes, sha256,
                                storage_path, visibility, uploaded_by)
  values (p_org, p_request, p_category, left(p_name, 200), p_mime, p_size, p_sha256, p_path, p_visibility, auth.uid())
  returning id into v_id;

  select name into v_org_name from public.organizations where id = p_org;
  if coalesce(public.is_staff(), false) then
    -- Atlas shared something with the client.
    if p_visibility = 'client' then
      perform public.notify_org_members(p_org, 'document_shared', 'New document from Atlas', left(p_name, 200), '/portal/documents');
    end if;
  else
    -- A client uploaded: tell the coordinator and Admins.
    insert into public.notifications (user_id, type, title, body, link)
    select distinct p.id, 'document_uploaded', 'Document uploaded: ' || v_org_name, left(p_name, 200), '/admin/documents'
    from public.organizations o
    left join public.inquiries i on i.id = o.source_inquiry_id
    join public.profiles p on p.is_active and p.staff_role is not null
         and (p.id = i.assigned_to or p.staff_role in ('SUPER_ADMIN', 'ADMIN'))
    where o.id = p_org;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------
-- Requests (staff)
-- ---------------------------------------------------------------
create function public.request_document(p_org uuid, p_title text, p_category public.document_category, p_note text, p_due date)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.document_requests (organization_id, title, category, note, due_date, requested_by)
  values (p_org, trim(p_title), p_category, nullif(trim(p_note), ''), p_due, auth.uid())
  returning id into v_id;
  perform public.notify_org_members(p_org, 'document_requested', 'Atlas requested a document', trim(p_title), '/portal/documents');
  return v_id;
end $$;

create function public.cancel_document_request(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  update public.document_requests set status = 'cancelled' where id = p_id and status = 'open';
  if not found then raise exception 'request_not_open' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------
-- Review (staff): accept, or reject with a reason the client sees.
-- Accepting a file fulfils its request.
-- ---------------------------------------------------------------
create function public.review_document(p_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.documents;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into v from public.documents where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status <> 'received' then raise exception 'already_reviewed' using errcode = 'P0001'; end if;
  if not p_accept and coalesce(trim(p_note), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;

  update public.documents
  set status = case when p_accept then 'accepted'::public.document_status else 'rejected'::public.document_status end,
      review_note = left(nullif(trim(p_note), ''), 2000), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;

  if p_accept and v.request_id is not null then
    update public.document_requests set status = 'fulfilled' where id = v.request_id and status = 'open';
  end if;
  if v.visibility = 'client' then
    perform public.notify_org_members(v.organization_id,
      case when p_accept then 'document_accepted' else 'document_rejected' end,
      case when p_accept then 'Document accepted: ' else 'Document needs replacing: ' end || v.file_name,
      case when p_accept then null else left(trim(p_note), 300) end, '/portal/documents');
  end if;
end $$;

-- ---------------------------------------------------------------
-- Download log (design 6.8): called by the server before handing out a link.
-- Only someone who can see the file (RLS) can get a log entry recorded.
-- ---------------------------------------------------------------
create function public.log_file_download(p_entity text, p_id uuid, p_kind text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if p_entity = 'documents' then
    select organization_id into v_org from public.documents
    where id = p_id and (public.is_staff() or (public.is_org_member(organization_id) and visibility = 'client'));
  elsif p_entity = 'agreements' then
    select organization_id into v_org from public.agreements
    where id = p_id and (public.is_staff() or (public.is_org_member(organization_id) and status <> 'draft'));
  end if;
  if v_org is null then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  insert into public.audit_log (actor_id, actor_role, organization_id, entity_type, entity_id, action, metadata)
  values (auth.uid(), public.audit_actor_role(), v_org, p_entity, p_id, 'download',
          case when p_kind is null then '{}'::jsonb else jsonb_build_object('kind', p_kind) end);
end $$;

revoke execute on function public.authorize_document_upload, public.record_document, public.request_document,
  public.cancel_document_request, public.review_document, public.log_file_download from public, anon;
grant execute on function public.authorize_document_upload, public.record_document, public.request_document,
  public.cancel_document_request, public.review_document, public.log_file_download to authenticated;
revoke execute on function public.document_file_lock, public.document_no_delete from public, anon, authenticated;

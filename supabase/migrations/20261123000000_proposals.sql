-- Module 4: proposals
-- Drafts are edited by staff; sending, revising, withdrawing and responding
-- happen only through the functions below, which enforce the business rules.

create type public.proposal_status as enum ('draft', 'sent', 'accepted', 'declined', 'superseded', 'withdrawn');
create type public.billing_type as enum ('fixed', 'monthly', 'yearly');
create type public.currency_code as enum ('LAK', 'USD', 'THB');

create sequence public.proposal_number_seq;

-- Today's date in Laos (UTC+7), used for "valid until".
create function public.lao_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Vientiane')::date $$;

create table public.proposals (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id),
  number              text not null default 'PRO-' || to_char(now() at time zone 'Asia/Vientiane', 'YYMM') || '-'
                                                || lpad(nextval('public.proposal_number_seq')::text, 4, '0'),
  version             int not null default 1 check (version >= 1),
  previous_id         uuid references public.proposals (id),
  title               text not null check (length(trim(title)) between 1 and 200),
  currency            public.currency_code not null default 'USD',
  introduction        text check (length(introduction) <= 5000),
  exclusions          text check (length(exclusions) <= 5000),
  payment_terms       text check (length(payment_terms) <= 5000),
  terms               text check (length(terms) <= 20000),
  valid_until         date not null,
  status              public.proposal_status not null default 'draft',
  created_by          uuid not null default auth.uid() references public.profiles (id),
  sent_at             timestamptz,
  sent_by             uuid references public.profiles (id),
  scope_confirmed_at  timestamptz,
  scope_confirmed_by  uuid references public.profiles (id),
  responded_at        timestamptz,
  responded_by        uuid references public.profiles (id),
  decline_reason      text check (length(decline_reason) <= 2000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (number, version)
);
create index proposals_org_idx on public.proposals (organization_id, created_at desc);

create table public.proposal_items (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals (id) on delete cascade,
  service_id    uuid references public.services (id),
  title         text not null check (length(trim(title)) between 1 and 200),
  scope         text check (length(scope) <= 5000),
  deliverables  text check (length(deliverables) <= 5000),
  billing       public.billing_type not null default 'fixed',
  amount        numeric(16, 2) not null check (amount >= 0 and amount < 100000000000000),
  sort_order    int not null default 0
);
create index proposal_items_proposal_idx on public.proposal_items (proposal_id, sort_order);

create trigger proposals_updated_at before update on public.proposals
  for each row execute function public.set_updated_at();
create trigger proposals_audit after insert or update on public.proposals
  for each row execute function public.audit_status_change();

-- ---------------------------------------------------------------
-- Lock: once a proposal leaves "draft", its content can never change.
-- (Applies to everyone, including the service key.)
-- ---------------------------------------------------------------
create function public.proposal_content_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (
       new.organization_id, new.number, new.version, new.title, new.currency, new.introduction,
       new.exclusions, new.payment_terms, new.terms, new.valid_until, new.previous_id
     ) is distinct from (
       old.organization_id, old.number, old.version, old.title, old.currency, old.introduction,
       old.exclusions, old.payment_terms, old.terms, old.valid_until, old.previous_id
     ) then
    raise exception 'proposal_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger proposals_content_lock before update on public.proposals
  for each row execute function public.proposal_content_lock();

create function public.proposal_items_lock() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status public.proposal_status;
begin
  select status into v_status from public.proposals
  where id = coalesce(new.proposal_id, old.proposal_id);
  if v_status is distinct from 'draft' and v_status is not null then
    raise exception 'proposal_locked' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger proposal_items_lock before insert or update or delete on public.proposal_items
  for each row execute function public.proposal_items_lock();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.proposals      enable row level security;
alter table public.proposal_items enable row level security;
revoke all on public.proposals, public.proposal_items from anon;
revoke truncate on public.proposals, public.proposal_items from authenticated;

-- Staff edit only the content of drafts. Status and the sent/response fields
-- have no column grant, so they change only through the functions below.
revoke update on public.proposals from authenticated;
grant update (title, currency, introduction, exclusions, payment_terms, terms, valid_until)
  on public.proposals to authenticated;

create policy proposals_select on public.proposals for select to authenticated
  using (public.is_staff() or (public.is_org_member(organization_id) and status <> 'draft'));
create policy proposals_staff_insert on public.proposals for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid() and status = 'draft'
              and sent_at is null and responded_at is null and previous_id is null and version = 1);
create policy proposals_staff_update on public.proposals for update to authenticated
  using (public.is_staff() and status = 'draft') with check (public.is_staff() and status = 'draft');
create policy proposals_staff_delete on public.proposals for delete to authenticated
  using (public.is_staff() and status = 'draft');

create policy items_select on public.proposal_items for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id
                 and (public.is_staff() or (public.is_org_member(p.organization_id) and p.status <> 'draft'))));
create policy items_staff_write on public.proposal_items for all to authenticated
  using (public.is_staff() and exists (select 1 from public.proposals p where p.id = proposal_id and p.status = 'draft'))
  with check (public.is_staff() and exists (select 1 from public.proposals p where p.id = proposal_id and p.status = 'draft'));

-- ---------------------------------------------------------------
-- Helpers for notifications and the inquiry stage
-- ---------------------------------------------------------------
create function public.notify_org_members(p_org uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select m.user_id, p_type, p_title, p_body, p_link
  from public.organization_members m join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org and m.status = 'active' and p.is_active;
$$;

-- Move the client's original inquiry forward (never backwards).
create function public.advance_inquiry_stage(p_org uuid, p_stage public.inquiry_stage)
returns void language sql security definer set search_path = '' as $$
  update public.inquiries i set status = p_stage
  from public.organizations o
  where o.id = p_org and i.id = o.source_inquiry_id
    and array_position(enum_range(null::public.inquiry_stage), i.status)
        < array_position(enum_range(null::public.inquiry_stage), p_stage)
    and i.status not in ('not_a_fit', 'spam');
$$;

-- ---------------------------------------------------------------
-- Send (Admin / Super admin only)
-- ---------------------------------------------------------------
create function public.send_proposal(p_id uuid, p_scope_confirmed boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.proposals;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.proposals where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  -- Owner's rule: never send a proposal before the scope has been assessed.
  if not coalesce(p_scope_confirmed, false) then raise exception 'scope_not_confirmed' using errcode = 'P0001'; end if;
  if v.valid_until < public.lao_today() then raise exception 'validity_passed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.proposal_items where proposal_id = p_id) then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  -- An earlier version still open becomes superseded.
  update public.proposals set status = 'superseded'
  where number = v.number and id <> p_id and status = 'sent';

  update public.proposals
  set status = 'sent', sent_at = now(), sent_by = auth.uid(),
      scope_confirmed_at = now(), scope_confirmed_by = auth.uid()
  where id = p_id;

  perform public.advance_inquiry_stage(v.organization_id, 'proposal');
  perform public.notify_org_members(v.organization_id, 'proposal_sent',
    'New proposal: ' || v.title, v.number || ' v' || v.version || ' is ready for your review.', '/portal/proposals/' || p_id);
end $$;

-- ---------------------------------------------------------------
-- Respond (client owner of that company only)
-- ---------------------------------------------------------------
create function public.respond_to_proposal(p_id uuid, p_accept boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.proposals;
begin
  select * into v from public.proposals where id = p_id for update;
  if not found or not coalesce(public.is_org_owner(v.organization_id), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v.status <> 'sent' then raise exception 'not_open' using errcode = 'P0001'; end if;
  if v.valid_until < public.lao_today() then raise exception 'expired' using errcode = 'P0001'; end if;

  update public.proposals
  set status = case when p_accept then 'accepted'::public.proposal_status else 'declined'::public.proposal_status end,
      responded_at = now(), responded_by = auth.uid(),
      decline_reason = case when p_accept then null else left(nullif(trim(p_reason), ''), 2000) end
  where id = p_id;

  if p_accept then
    perform public.advance_inquiry_stage(v.organization_id, 'agreement');
  end if;

  -- Tell the people at Atlas who worked on it, plus Admins.
  insert into public.notifications (user_id, type, title, body, link)
  select distinct p.id,
         case when p_accept then 'proposal_accepted' else 'proposal_declined' end,
         case when p_accept then 'Proposal accepted: ' else 'Proposal declined: ' end || v.number || ' v' || v.version,
         o.name || ' · ' || v.title, '/admin/proposals/' || p_id
  from public.profiles p
  cross join public.organizations o
  left join public.inquiries i on i.id = o.source_inquiry_id
  where o.id = v.organization_id and p.is_active and p.staff_role is not null
    and (p.id in (v.sent_by, v.created_by, i.assigned_to) or p.staff_role in ('SUPER_ADMIN', 'ADMIN'));
end $$;

-- ---------------------------------------------------------------
-- Revise: start the next version as a draft (any staff member)
-- ---------------------------------------------------------------
create function public.revise_proposal(p_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.proposals;
  v_new uuid;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into v from public.proposals where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status not in ('sent', 'declined', 'withdrawn') then raise exception 'cannot_revise' using errcode = 'P0001'; end if;

  -- Only one open draft per proposal number: reuse it if it exists.
  select id into v_new from public.proposals where number = v.number and status = 'draft';
  if v_new is not null then return v_new; end if;

  insert into public.proposals (organization_id, number, version, previous_id, title, currency, introduction,
                                exclusions, payment_terms, terms, valid_until, created_by)
  select v.organization_id, v.number, max(x.version) + 1, v.id, v.title, v.currency, v.introduction,
         v.exclusions, v.payment_terms, v.terms, greatest(v.valid_until, public.lao_today() + 30), auth.uid()
  from public.proposals x where x.number = v.number
  returning id into v_new;

  insert into public.proposal_items (proposal_id, service_id, title, scope, deliverables, billing, amount, sort_order)
  select v_new, service_id, title, scope, deliverables, billing, amount, sort_order
  from public.proposal_items where proposal_id = v.id;
  return v_new;
end $$;

-- ---------------------------------------------------------------
-- Withdraw a sent proposal (Admin / Super admin)
-- ---------------------------------------------------------------
create function public.withdraw_proposal(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.proposals;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.proposals where id = p_id for update;
  if not found or v.status <> 'sent' then raise exception 'not_open' using errcode = 'P0001'; end if;
  update public.proposals set status = 'withdrawn' where id = p_id;
  perform public.notify_org_members(v.organization_id, 'proposal_withdrawn',
    'Proposal withdrawn: ' || v.title, v.number || ' v' || v.version || ' is no longer open. Atlas will be in touch.', '/portal/proposals/' || p_id);
end $$;

revoke execute on function public.send_proposal, public.respond_to_proposal, public.revise_proposal,
  public.withdraw_proposal from public, anon;
grant execute on function public.send_proposal, public.respond_to_proposal, public.revise_proposal,
  public.withdraw_proposal to authenticated;
revoke execute on function public.notify_org_members, public.advance_inquiry_stage,
  public.proposal_content_lock, public.proposal_items_lock from public, anon, authenticated;

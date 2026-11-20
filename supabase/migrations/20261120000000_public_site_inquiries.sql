-- Module 1: public website + inquiry form
-- Tables: services, inquiries, inquiry_services

-- ---------------------------------------------------------------
-- 1. Service catalogue (public)
-- ---------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  code             text not null unique,
  name             text not null,
  name_lo          text,
  summary          text not null,
  includes         text[] not null default '{}',
  audience         text,
  deliverables     text[] not null default '{}',
  assessment_name  text,
  sort_order       int not null default 0,
  is_public        boolean not null default true,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;
revoke all on public.services from anon;
grant select on public.services to anon;
revoke truncate, delete on public.services from authenticated;

-- Everyone (even logged-out visitors) sees published services; staff see all.
create policy services_public_select on public.services for select to anon, authenticated
  using ((is_public and is_active) or public.is_staff());
create policy services_admin_insert on public.services for insert to authenticated
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN'));
create policy services_admin_update on public.services for update to authenticated
  using (public.staff_role() in ('SUPER_ADMIN', 'ADMIN'))
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN'));

insert into public.services (slug, code, name, name_lo, summary, includes, audience, deliverables, assessment_name, sort_order) values
('accounting', 'ACC', 'Accounting Services', 'ບໍລິການບັນຊີ',
 'Bookkeeping, monthly closing and statutory financial statements prepared to Lao accounting standards.',
 array['Monthly bookkeeping and bank reconciliation','Chart of accounts set-up or review','Accounts receivable and payable management','Monthly and annual financial statements','Tax and statutory reporting support','Fixed asset and inventory records'],
 'Companies that need reliable books without a full in-house finance team, or that want an existing team reviewed.',
 array['Monthly management accounts','Annual financial statements','Reconciliation pack','Tax filing schedule'],
 'Accounting assessment', 1),
('advisory', 'FIN', 'Financial Advisory', 'ທີ່ປຶກສາດ້ານການເງິນ',
 'Cash-flow, budgeting, profitability and management reporting that helps owners make better decisions.',
 array['Cash-flow analysis and forecasting','Budget preparation and monitoring','Margin and profitability review','Debt and financing review','Management reporting design','Investment and expansion analysis'],
 'Owners and managers who have numbers but need them turned into decisions.',
 array['Financial health review','12-month cash-flow forecast','Annual budget','Management report template'],
 'Financial assessment', 2),
('startup', 'NEW', 'Business Startup', 'ການເລີ່ມຕົ້ນທຸລະກິດ',
 'From business model to registration and a working finance structure on day one.',
 array['Business model and plan review','Capital and ownership structure','Company registration guidance','Organizational structure','Opening accounting set-up','Launch-stage financial plan'],
 'Founders and investors setting up a new company or entering Laos.',
 array['Startup roadmap','Registration checklist','Opening chart of accounts','First-year financial plan'],
 'Startup assessment', 3),
('improvement', 'OPS', 'Business Improvement', 'ການປັບປຸງທຸລະກິດ',
 'Process, controls and operations review to remove waste and strengthen how the business runs.',
 array['Process mapping and review','Internal control assessment','Operating cost review','Policy and procedure design','KPI and performance framework','Implementation support'],
 'Growing businesses where processes have not kept up with the size of the operation.',
 array['Operations diagnostic report','Control gap register','Improvement roadmap','KPI dashboard design'],
 'Operations assessment', 4);

-- ---------------------------------------------------------------
-- 2. Inquiries (staff-only; written only by submit_inquiry())
-- ---------------------------------------------------------------
create type public.inquiry_status as enum ('new', 'in_review', 'qualified', 'disqualified', 'converted', 'spam');

create sequence public.inquiry_ref_seq;

create table public.inquiries (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique
                  default 'INQ-' || to_char(now() at time zone 'Asia/Vientiane', 'YYMM') || '-'
                          || lpad(nextval('public.inquiry_ref_seq')::text, 4, '0'),
  company_name    text not null check (length(company_name) between 1 and 200),
  contact_name    text not null check (length(contact_name) between 1 and 120),
  email           text not null check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text not null check (length(phone) between 8 and 40),
  industry        text not null check (length(industry) <= 80),
  company_size    text check (length(company_size) <= 20),
  challenge       text not null check (length(challenge) between 10 and 4000),
  preferred_date  date,
  consent_at      timestamptz not null,
  source          text not null default 'web_form',
  status          public.inquiry_status not null default 'new',
  assigned_to     uuid references public.profiles (id),
  ip_hash         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index inquiries_ip_recent_idx on public.inquiries (ip_hash, created_at);
create trigger inquiries_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();
create trigger inquiries_audit after insert or update on public.inquiries
  for each row execute function public.audit_status_change();

create table public.inquiry_services (
  inquiry_id  uuid not null references public.inquiries (id) on delete cascade,
  service_id  uuid not null references public.services (id),
  primary key (inquiry_id, service_id)
);

alter table public.inquiries        enable row level security;
alter table public.inquiry_services enable row level security;
revoke all on public.inquiries, public.inquiry_services from anon;
revoke insert, delete, truncate on public.inquiries, public.inquiry_services from authenticated;

-- No client rule at all: only staff (after MFA) can see inquiries.
create policy inquiries_staff_select on public.inquiries for select to authenticated
  using (public.is_staff());
create policy inquiries_staff_update on public.inquiries for update to authenticated
  using (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'))
  with check (public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'));
create policy inquiry_services_staff_select on public.inquiry_services for select to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------
-- 3. One safe door for the public form
-- Saves the inquiry and its services in one step (all or nothing),
-- and enforces the rate limit inside the database.
-- Only the server (service key) may call it.
-- ---------------------------------------------------------------
create function public.submit_inquiry(
  p_company_name text, p_contact_name text, p_email text, p_phone text,
  p_industry text, p_company_size text, p_challenge text, p_preferred_date date,
  p_service_slugs text[], p_ip_hash text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ref text;
  v_services uuid[];
begin
  if p_ip_hash is not null and (
    select count(*) from public.inquiries
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select array_agg(id) into v_services from public.services
  where slug = any (p_service_slugs) and is_public and is_active;
  if v_services is null or cardinality(v_services) <> cardinality(p_service_slugs) then
    raise exception 'invalid_service' using errcode = 'P0001';
  end if;

  insert into public.inquiries (company_name, contact_name, email, phone, industry, company_size,
                                challenge, preferred_date, consent_at, ip_hash)
  values (p_company_name, p_contact_name, lower(p_email), p_phone, p_industry, nullif(p_company_size, ''),
          p_challenge, p_preferred_date, now(), p_ip_hash)
  returning id, reference into v_id, v_ref;

  insert into public.inquiry_services (inquiry_id, service_id)
  select v_id, unnest(v_services);

  return v_ref;
end $$;

revoke execute on function public.submit_inquiry from public, anon, authenticated;
grant execute on function public.submit_inquiry to service_role;

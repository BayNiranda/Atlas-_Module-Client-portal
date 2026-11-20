-- Module 5: client pre-assessment (questionnaire filled in the client portal)
-- Generated from supabase/seed-data/assessments.sql.template + pre-assessment-v1.json

-- ---------------------------------------------------------------
-- 1. Questionnaire templates and immutable published versions
-- ---------------------------------------------------------------
create type public.template_version_status as enum ('draft', 'published', 'retired');

create table public.assessment_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.assessment_template_versions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.assessment_templates (id),
  version       int not null check (version >= 1),
  definition    jsonb not null,
  status        public.template_version_status not null default 'draft',
  published_at  timestamptz,
  published_by  uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique (template_id, version)
);

-- A published version can never be edited (only retired). Old answers always
-- match the exact questions the client saw.
create function public.template_version_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.definition is distinct from old.definition
       or new.version is distinct from old.version or new.template_id is distinct from old.template_id
       or (new.status = 'draft')) then
    raise exception 'template_version_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger template_versions_lock before update on public.assessment_template_versions
  for each row execute function public.template_version_lock();

alter table public.assessment_templates enable row level security;
alter table public.assessment_template_versions enable row level security;
revoke all on public.assessment_templates, public.assessment_template_versions from anon;
revoke insert, update, delete, truncate on public.assessment_templates, public.assessment_template_versions from authenticated;
-- Everyone signed in may read published questionnaires (they contain only questions).
create policy templates_read on public.assessment_templates for select to authenticated using (true);
create policy template_versions_read on public.assessment_template_versions for select to authenticated
  using (status <> 'draft' or public.is_staff());

-- ---------------------------------------------------------------
-- 2. Assessments: one per client company, pinned to a version
-- ---------------------------------------------------------------
create type public.assessment_status as enum ('not_started', 'in_progress', 'submitted', 'changes_requested', 'approved');

create table public.assessments (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null unique references public.organizations (id) on delete cascade,
  template_version_id  uuid not null references public.assessment_template_versions (id),
  status               public.assessment_status not null default 'not_started',
  answers              jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) < 200000),
  updated_by           uuid references public.profiles (id),
  submitted_at         timestamptz,
  submitted_by         uuid references public.profiles (id),
  reviewed_at          timestamptz,
  reviewed_by          uuid references public.profiles (id),
  review_comment       text check (length(review_comment) <= 2000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger assessments_updated_at before update on public.assessments
  for each row execute function public.set_updated_at();
create trigger assessments_audit after insert or update on public.assessments
  for each row execute function public.audit_status_change();

-- Approved answers can never change (applies to everyone, including the service key).
create function public.assessment_answers_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'approved' and (new.answers is distinct from old.answers or new.template_version_id is distinct from old.template_version_id) then
    raise exception 'assessment_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger assessments_answers_lock before update on public.assessments
  for each row execute function public.assessment_answers_lock();

alter table public.assessments enable row level security;
revoke all on public.assessments from anon;
-- No direct writes at all: saving, submitting and reviewing go through the functions below.
revoke insert, update, delete, truncate on public.assessments from authenticated;
create policy assessments_select on public.assessments for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

-- ---------------------------------------------------------------
-- 3. Seed: the owner's questionnaire as published version 1
-- ---------------------------------------------------------------
with t as (
  insert into public.assessment_templates (code, name) values ('pre_assessment', 'Client pre-assessment questionnaire')
  returning id
)
insert into public.assessment_template_versions (template_id, version, definition, status, published_at)
select t.id, 1, $json${"title":"Client pre-assessment questionnaire","intro":["Tell us about your business and the challenges you face. This short questionnaire takes about 5–10 minutes and helps us prepare for our first conversation and recommend the right service for you."],"safety_title":"Your safety comes first:","safety":["We only ask about your needs and general business situation.","We will NEVER ask for bank account numbers, passwords, ID cards, tax ID numbers or financial documents at this stage.","Please do not upload or send any documents with this form.","If anyone claiming to be Atlas asks you for these details before a signed engagement letter, do not respond — contact us directly."],"required_note":"Fields marked * are required.","thank_you":["Thank you! Our team will review your answers and contact you within 1–2 working days to arrange a free discovery meeting.","Reminder: Atlas will never ask for passwords, bank account numbers or documents by phone, WhatsApp or email before you have met our team and signed an engagement letter. If you receive such a request, please contact us directly on our official number."],"sections":[{"id":"s1","title":"Contact","questions":[{"id":"1.1","label":"Your name","type":"short_text","required":true,"max":120,"prefill":"contact_name"},{"id":"1.2","label":"Your role in the business","type":"select","required":true,"options":["Owner / Founder","Director / Managing Director","Finance / Accounting staff","Other (please specify)"],"other":"Other (please specify)"},{"id":"1.3","label":"Business email","type":"email","required":true,"prefill":"email"},{"id":"1.4","label":"Phone / WhatsApp number","type":"phone","required":true,"prefill":"phone"},{"id":"1.5","label":"Preferred way to contact you","type":"radio","required":true,"options":["Phone call","WhatsApp","Email","Meeting at our office"]},{"id":"1.6","label":"Preferred language","type":"radio","required":true,"options":["Lao","English","Thai"]},{"id":"1.7","label":"How did you hear about Atlas?","type":"select","required":false,"options":["Referral from a client or friend","Facebook / social media","Google search","Bank or business partner","Event / seminar","Other"]}]},{"id":"s2","title":"Business profile (general information only)","questions":[{"id":"2.1","label":"Business / trading name","type":"short_text","required":true,"max":200,"prefill":"company_name"},{"id":"2.2","label":"Province / city","type":"select","required":true,"options":["Vientiane Capital","Attapeu","Bokeo","Bolikhamxay","Champasak","Houaphanh","Khammouane","Luang Namtha","Luang Prabang","Oudomxay","Phongsaly","Salavan","Savannakhet","Sekong","Vientiane Province","Xaiyabouly","Xaisomboun","Xiengkhouang"]},{"id":"2.3","label":"Industry","type":"select","required":true,"options":["Trading / Wholesale / Retail","Manufacturing","Construction / Real estate","Hotel / Restaurant / Tourism","Services / Consulting","Agriculture / Plantation","Transport / Logistics","Import / Export","Mining / Energy","Education / Healthcare","NGO / Non-profit","Other (please specify)"],"other":"Other (please specify)"},{"id":"2.4","label":"Briefly describe what your business does","type":"long_text","required":true,"max":300},{"id":"2.5","label":"Type of business","type":"select","required":true,"options":["Individual / Sole enterprise","Limited company (Co., Ltd.)","Sole limited company","Public company","Foreign-invested company","Branch / Representative office","Not yet registered (planning to start)","Not sure"]},{"id":"2.6","label":"How long has the business been operating?","type":"radio","required":true,"options":["Not started yet","Less than 1 year","1–3 years","3–5 years","More than 5 years"]},{"id":"2.7","label":"Number of employees","type":"radio","required":true,"options":["1–5","6–20","21–50","51–200","More than 200"]},{"id":"2.8","label":"Approximate annual revenue","type":"radio","required":true,"options":["Below 500 million LAK","500 million – 1 billion LAK","1 – 5 billion LAK","5 – 20 billion LAK","Above 20 billion LAK","Prefer not to say"]},{"id":"2.9","label":"Does your business have more than one company, branch or location?","type":"radio","required":false,"options":["No, only one","Yes, 2–3","Yes, more than 3"]},{"id":"2.10","label":"Which currencies do you trade in? (tick all)","type":"checkbox","required":false,"options":["LAK","THB","USD","CNY","Other"]},{"id":"2.11","label":"Main ways you get paid / pay (tick all)","type":"checkbox","required":false,"options":["Cash","Bank transfer","QR / mobile banking","Credit terms (invoice, pay later)"]},{"id":"2.12","label":"Do you hold inventory / stock?","type":"radio","required":false,"options":["Yes","No"]},{"id":"2.13","label":"Do you have significant fixed assets (vehicles, machinery, buildings)?","type":"radio","required":false,"options":["Yes","No"]}]},{"id":"s3","title":"Current accounting status","questions":[{"id":"3.1","label":"Who keeps your books today?","type":"radio","required":true,"options":["No one / not keeping books yet","The owner","In-house accountant","External accountant / firm","Other"]},{"id":"3.2","label":"How are your records kept?","type":"radio","required":true,"options":["Paper / notebooks","Excel","Accounting software","Mixed","Not sure"]},{"id":"3.3","label":"If software, which one?","type":"select","required":false,"options":["Zoho Books","QuickBooks","Xero","Local Lao software","Other"]},{"id":"3.4","label":"How up to date are your books?","type":"radio","required":true,"options":["Up to date (within 1 month)","1–3 months behind","3–6 months behind","6–12 months behind","More than 1 year behind","Not sure"]},{"id":"3.5","label":"Are your bank accounts reconciled each month?","type":"radio","required":true,"options":["Yes","Sometimes","No","Not sure"]},{"id":"3.6","label":"Roughly how many transactions per month?","type":"radio","required":false,"options":["Fewer than 50","50–200","200–500","More than 500","Not sure"]},{"id":"3.7","label":"Do you receive monthly financial reports (P&L, balance sheet)?","type":"radio","required":true,"options":["Yes, every month","Only at year-end","No"]},{"id":"3.8","label":"Which accounting standard do you report under?","type":"radio","required":false,"options":["Lao Accounting Standards","IFRS / IFRS for SMEs","Not sure"]},{"id":"3.9","label":"Have your financial statements ever been audited?","type":"radio","required":false,"options":["Yes, every year","Yes, once or occasionally","No","Not sure"]},{"id":"3.10","label":"How would you rate your current financial records?","type":"scale","required":true,"min":1,"max":5,"min_label":"Very poor / disorganized","max_label":"Excellent"}]},{"id":"s4","title":"Tax & compliance status","questions":[{"id":"4.1","label":"Is your business registered for tax?","type":"radio","required":true,"options":["Yes","No","In process","Not sure"]},{"id":"4.2","label":"Are you registered for VAT?","type":"radio","required":false,"options":["Yes","No","Not sure"]},{"id":"4.3","label":"Are your monthly tax filings up to date?","type":"radio","required":true,"options":["Yes, all filed on time","Some are late","Many are late / not filed","Not sure"]},{"id":"4.4","label":"Is your annual tax return / financial statement filed for the last year?","type":"radio","required":true,"options":["Yes","No","Not sure"]},{"id":"4.5","label":"Are you currently facing any of the following? (tick all)","type":"checkbox","required":false,"options":["Tax penalties or fines","Tax audit / inspection from the tax office","Disagreement with the tax office","Payroll / social security issues","None","Prefer to discuss in person"]},{"id":"4.6","label":"Do you run payroll for employees?","type":"radio","required":false,"options":["Yes","No"]},{"id":"4.7","label":"Are you regulated by a specific authority (e.g., Bank of Lao PDR, investment promotion, sector ministry)?","type":"radio","required":false,"options":["Yes","No","Not sure"]}]},{"id":"s5","title":"Your challenges","questions":[{"id":"5.1","label":"What are your biggest financial challenges right now? (tick all that apply)","type":"checkbox","required":true,"options":["My books are behind or messy","I don't know my real profit","Cash flow is tight / I run out of cash","Customers pay late","Tax filing and penalties","Preparing for an audit","Need financial statements for a bank loan","Need reports for investors / partners / shareholders","Costs are too high / margins are falling","No budget or forecast","Weak internal controls / worried about fraud or errors","Inventory is hard to track","Business is growing and the finance function can't keep up","Planning to expand, invest or sell the business","Setting up a new business correctly","Other (please specify)"],"other":"Other (please specify)"},{"id":"5.2","label":"Which ONE challenge is the most urgent?","type":"short_text","required":true,"max":200},{"id":"5.3","label":"What has happened because of this problem? (e.g., missed loan, penalties, decisions delayed)","type":"long_text","required":false,"max":500},{"id":"5.4","label":"What have you tried so far to fix it?","type":"long_text","required":false,"max":500},{"id":"5.5","label":"How do you currently make financial decisions?","type":"radio","required":false,"options":["Gut feeling / experience","Bank balance","Basic reports","Detailed reports and forecasts"]}]},{"id":"s6","title":"Services & goals","questions":[{"id":"6.1","label":"Which services are you interested in? (tick all)","type":"checkbox","required":true,"options":["Monthly bookkeeping","Clean-up / catch-up of past records","Monthly / annual tax filing","Payroll processing","Financial statements preparation","Audit preparation support","Budget & cash flow forecasting","Management reporting & KPI dashboard","Part-time / outsourced CFO","Accounting software setup (e.g., Zoho Books)","Internal control review","Business plan / loan application support","Business setup & registration advice","Training for in-house accounting staff","Not sure — please advise me"]},{"id":"6.2","label":"Who will use the reports we prepare? (tick all)","type":"checkbox","required":false,"options":["Owner / management","Tax office","Bank / lender","Investors / shareholders","Auditor","Government / regulator"]},{"id":"6.3","label":"What would success look like in 12 months?","type":"long_text","required":false,"max":500},{"id":"6.4","label":"Business plans in the next 1–2 years (tick all)","type":"checkbox","required":false,"options":["Stay stable","Grow sales","Open new branch / location","Apply for a bank loan","Bring in investors / partners","Sell or restructure the business","Not decided"]}]},{"id":"s7","title":"Timing & working style","questions":[{"id":"7.1","label":"When do you need help to start?","type":"radio","required":true,"options":["Immediately (urgent)","Within 1 month","Within 3 months","Just exploring"]},{"id":"7.2","label":"Do you have a specific deadline? (e.g., tax due date, bank meeting, audit)","type":"short_text","required":false,"max":200},{"id":"7.3","label":"Type of engagement you prefer","type":"radio","required":true,"options":["Ongoing monthly service","One-time project","Not sure"]},{"id":"7.4","label":"How often would you like to meet with us?","type":"radio","required":false,"options":["Weekly","Monthly","Quarterly","Only when needed"]},{"id":"7.5","label":"Preferred way of working","type":"radio","required":false,"options":["Fully remote (online)","On-site at my office","Mix of both"]},{"id":"7.6","label":"Approximate monthly budget for financial services","type":"radio","required":false,"options":["Below 2 million LAK","2 – 5 million LAK","5 – 15 million LAK","Above 15 million LAK","Not sure / need a quote"]},{"id":"7.7","label":"Anything else you'd like us to know?","type":"long_text","required":false,"max":1000,"help":"Please do NOT include bank details, passwords or ID numbers."}]},{"id":"s8","title":"Consent","questions":[{"id":"8.1","label":"I confirm the information above is general and accurate to the best of my knowledge.","type":"consent","required":true},{"id":"8.2","label":"I agree that Atlas Advisory may contact me about my enquiry and use this information only to prepare a proposal.","type":"consent","required":true},{"id":"8.3","label":"I would like to receive Atlas news and tips (optional).","type":"consent","required":false}]}]}$json$::jsonb, 'published', now() from t;

-- The newest published version of the pre-assessment.
create function public.current_pre_assessment_version() returns uuid
language sql stable security definer set search_path = '' as $$
  select v.id from public.assessment_template_versions v
  join public.assessment_templates t on t.id = v.template_id
  where t.code = 'pre_assessment' and v.status = 'published'
  order by v.version desc limit 1;
$$;

-- Every client company gets its pre-assessment automatically.
create function public.open_pre_assessment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assessments (organization_id, template_version_id)
  values (new.id, public.current_pre_assessment_version())
  on conflict (organization_id) do nothing;
  return new;
end $$;
create trigger organizations_open_pre_assessment after insert on public.organizations
  for each row execute function public.open_pre_assessment();

-- Existing companies (including test data) get one too.
insert into public.assessments (organization_id, template_version_id)
select o.id, public.current_pre_assessment_version() from public.organizations o
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------
-- 4. Save / submit (client members of that company)
-- The server checks every answer against the version's questions before calling.
-- ---------------------------------------------------------------
create function public.save_assessment(p_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.assessments;
begin
  select * into v from public.assessments where id = p_id for update;
  if not found or not coalesce(public.is_org_member(v.organization_id), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v.status not in ('not_started', 'in_progress', 'changes_requested') then
    raise exception 'not_editable' using errcode = 'P0001';
  end if;
  update public.assessments
  set answers = p_answers, updated_by = auth.uid(),
      status = case when v.status = 'not_started' then 'in_progress'::public.assessment_status else v.status end
  where id = p_id;
end $$;

create function public.submit_assessment(p_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.assessments;
begin
  perform public.save_assessment(p_id, p_answers);
  select * into v from public.assessments where id = p_id;
  update public.assessments
  set status = 'submitted', submitted_at = now(), submitted_by = auth.uid(), review_comment = null
  where id = p_id;

  -- Tell the coordinator (inquiry owner) and all Admins.
  insert into public.notifications (user_id, type, title, body, link)
  select distinct p.id, 'assessment_submitted', 'Pre-assessment submitted: ' || o.name,
         'Ready for review.', '/admin/assessments/' || p_id
  from public.organizations o
  left join public.inquiries i on i.id = o.source_inquiry_id
  join public.profiles p on p.is_active and p.staff_role is not null
       and (p.id = i.assigned_to or p.staff_role in ('SUPER_ADMIN', 'ADMIN'))
  where o.id = v.organization_id;
end $$;

-- ---------------------------------------------------------------
-- 5. Review (any staff member, after MFA)
-- ---------------------------------------------------------------
create function public.review_assessment(p_id uuid, p_approve boolean, p_comment text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.assessments;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into v from public.assessments where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  if not p_approve and coalesce(trim(p_comment), '') = '' then
    raise exception 'comment_required' using errcode = 'P0001';
  end if;

  update public.assessments
  set status = case when p_approve then 'approved'::public.assessment_status else 'changes_requested'::public.assessment_status end,
      reviewed_at = now(), reviewed_by = auth.uid(), review_comment = left(nullif(trim(p_comment), ''), 2000)
  where id = p_id;

  perform public.notify_org_members(v.organization_id,
    case when p_approve then 'assessment_approved' else 'assessment_changes' end,
    case when p_approve then 'Pre-assessment approved' else 'Pre-assessment: changes requested' end,
    case when p_approve then 'Thank you. Atlas will now prepare your proposal.' else left(trim(p_comment), 300) end,
    '/portal/assessment');
end $$;

revoke execute on function public.save_assessment, public.submit_assessment, public.review_assessment from public, anon;
grant execute on function public.save_assessment, public.submit_assessment, public.review_assessment to authenticated;
revoke execute on function public.open_pre_assessment, public.template_version_lock, public.assessment_answers_lock,
  public.current_pre_assessment_version from public, anon, authenticated;

-- ---------------------------------------------------------------
-- 6. Proposals: sending now requires an approved pre-assessment
-- (replaces the temporary "scope assessed" tick-box from Module 4)
-- ---------------------------------------------------------------
alter table public.proposals add column assessment_id uuid references public.assessments (id);

drop function public.send_proposal(uuid, boolean);
create function public.send_proposal(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.proposals;
  v_assessment uuid;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.proposals where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  -- Owner's rule: never send a proposal before the scope has been assessed.
  select id into v_assessment from public.assessments where organization_id = v.organization_id and status = 'approved';
  if v_assessment is null then raise exception 'assessment_not_approved' using errcode = 'P0001'; end if;
  if v.valid_until < public.lao_today() then raise exception 'validity_passed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.proposal_items where proposal_id = p_id) then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  update public.proposals set status = 'superseded'
  where number = v.number and id <> p_id and status = 'sent';

  update public.proposals
  set status = 'sent', sent_at = now(), sent_by = auth.uid(), assessment_id = v_assessment
  where id = p_id;

  perform public.advance_inquiry_stage(v.organization_id, 'proposal');
  perform public.notify_org_members(v.organization_id, 'proposal_sent',
    'New proposal: ' || v.title, v.number || ' v' || v.version || ' is ready for your review.', '/portal/proposals/' || p_id);
end $$;
revoke execute on function public.send_proposal from public, anon;
grant execute on function public.send_proposal to authenticated;

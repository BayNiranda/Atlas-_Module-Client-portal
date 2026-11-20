-- Module 8: projects
-- A signed agreement becomes one project per proposal line. Staff move each
-- project through its stages, assign people and keep a simple task list;
-- clients follow progress (client-visible tasks only) and raise requests.

create type public.project_status as enum ('onboarding', 'in_delivery', 'on_hold', 'completed', 'cancelled');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.service_request_status as enum ('open', 'in_review', 'resolved', 'closed');

create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id),
  agreement_id      uuid not null references public.agreements (id),
  proposal_item_id  uuid unique references public.proposal_items (id),
  service_id        uuid references public.services (id),
  name              text not null check (length(trim(name)) between 1 and 200),
  status            public.project_status not null default 'onboarding',
  coordinator_id    uuid references public.profiles (id),
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index projects_org_idx on public.projects (organization_id, created_at);

create table public.project_staff (
  project_id  uuid not null references public.projects (id),
  user_id     uuid not null references public.profiles (id),
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id),
  title           text not null check (length(trim(title)) between 1 and 200),
  description     text check (length(description) <= 2000),
  status          public.task_status not null default 'todo',
  assignee_id     uuid references public.profiles (id),
  due_date        date,
  client_visible  boolean not null default false,
  completed_at    timestamptz,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id, created_at);

create table public.service_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id),
  project_id       uuid references public.projects (id),
  subject          text not null check (length(trim(subject)) between 1 and 200),
  description      text not null check (length(trim(description)) between 1 and 4000),
  status           public.service_request_status not null default 'open',
  reply            text check (length(reply) <= 4000),
  replied_by       uuid references public.profiles (id),
  replied_at       timestamptz,
  created_by       uuid not null default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index service_requests_org_idx on public.service_requests (organization_id, created_at desc);
create index service_requests_open_idx on public.service_requests (status) where status in ('open', 'in_review');

create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger service_requests_updated_at before update on public.service_requests for each row execute function public.set_updated_at();
create trigger projects_audit after insert or update on public.projects for each row execute function public.audit_status_change();
create trigger tasks_audit after insert or update on public.tasks for each row execute function public.audit_status_change();
create trigger service_requests_audit after insert or update on public.service_requests for each row execute function public.audit_status_change();

-- Projects are never deleted (they are cancelled instead).
create function public.project_no_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'project_locked' using errcode = 'P0001';
end $$;
create trigger projects_no_delete before delete on public.projects for each row execute function public.project_no_delete();

-- ---------------------------------------------------------------
-- Who may manage a project: coordinator and above, or staff on that project.
-- ---------------------------------------------------------------
create function public.can_manage_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false)
      or (coalesce(public.is_staff(), false) and (
            exists (select 1 from public.projects where id = p_project and coordinator_id = auth.uid())
         or exists (select 1 from public.project_staff where project_id = p_project and user_id = auth.uid())));
$$;

-- Tasks: assignee must be Atlas staff; the finish time follows the status.
create function public.task_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.profiles where id = new.assignee_id and staff_role is not null and is_active
  ) then
    raise exception 'assignee_not_staff' using errcode = 'P0001';
  end if;
  new.completed_at := case when new.status = 'done' then coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now()) end;
  return new;
end $$;
create trigger tasks_before_write before insert or update on public.tasks for each row execute function public.task_before_write();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_staff enable row level security;
alter table public.tasks enable row level security;
alter table public.service_requests enable row level security;
revoke all on public.projects, public.project_staff, public.tasks, public.service_requests from anon;
revoke insert, update, delete, truncate on public.projects, public.project_staff, public.service_requests from authenticated;
revoke insert, update, delete, truncate on public.tasks from authenticated;

create policy projects_select on public.projects for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));
create policy project_staff_select on public.project_staff for select to authenticated
  using (public.is_staff());
create policy service_requests_select on public.service_requests for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

-- Tasks: clients see only client-visible tasks of their own company's projects.
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_staff() or (client_visible and exists (
    select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id))));
-- Staff who may manage the project write tasks directly (column grants keep
-- the project and author fixed once created).
grant insert (project_id, title, description, status, assignee_id, due_date, client_visible) on public.tasks to authenticated;
grant update (title, description, status, assignee_id, due_date, client_visible) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_manage_project(project_id) and created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.can_manage_project(project_id));

-- ---------------------------------------------------------------
-- A signed agreement creates one project per proposal line (once per line,
-- so a signed amendment of the same proposal adds nothing twice).
-- ---------------------------------------------------------------
create function public.create_agreement_projects() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
  v_org text;
begin
  insert into public.projects (organization_id, agreement_id, proposal_item_id, service_id, name)
  select new.organization_id, new.id, i.id, i.service_id, i.title
  from public.proposal_items i
  where i.proposal_id = new.proposal_id
    and not exists (select 1 from public.projects p where p.proposal_item_id = i.id)
  order by i.sort_order;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    select name into v_org from public.organizations where id = new.organization_id;
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'projects_created', 'New projects: ' || v_org,
           v_count || ' project(s) from agreement ' || new.number || ' need a coordinator.', '/admin/projects'
    from public.profiles p
    where p.is_active and p.staff_role in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR');
  end if;
  return new;
end $$;
create trigger agreements_create_projects after update of status on public.agreements
  for each row when (new.status = 'signed' and old.status is distinct from 'signed')
  execute function public.create_agreement_projects();

-- Agreements signed before this module get their projects now.
insert into public.projects (organization_id, agreement_id, proposal_item_id, service_id, name)
select a.organization_id, a.id, i.id, i.service_id, i.title
from public.agreements a
join public.proposal_items i on i.proposal_id = a.proposal_id
where a.status = 'signed'
on conflict (proposal_item_id) do nothing;

-- ---------------------------------------------------------------
-- Stage (coordinator and above). The client is told.
-- ---------------------------------------------------------------
create function public.set_project_status(p_id uuid, p_status public.project_status)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.projects;
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.projects where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status = p_status then return; end if;

  update public.projects
  set status = p_status,
      started_at = case when p_status = 'in_delivery' then coalesce(started_at, now()) else started_at end,
      completed_at = case when p_status = 'completed' then now() end
  where id = p_id;

  perform public.notify_org_members(v.organization_id, 'project_status', 'Project update: ' || v.name,
    'Now: ' || case p_status when 'onboarding' then 'Onboarding' when 'in_delivery' then 'In delivery'
                             when 'on_hold' then 'On hold' when 'completed' then 'Completed' else 'Cancelled' end || '.',
    '/portal/projects');
end $$;

-- ---------------------------------------------------------------
-- Team (coordinator and above): one coordinator plus any staff.
-- Newly added people are told.
-- ---------------------------------------------------------------
create function public.set_project_team(p_id uuid, p_coordinator uuid, p_staff uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.projects;
  v_staff uuid[] := coalesce(p_staff, '{}');
  v_new uuid[];
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.projects where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if exists (
    select 1 from unnest(v_staff || p_coordinator) u(id)
    where u.id is not null and not exists (select 1 from public.profiles p where p.id = u.id and p.staff_role is not null and p.is_active)
  ) then
    raise exception 'not_staff' using errcode = 'P0001';
  end if;

  select array_agg(distinct u.id) into v_new
  from unnest(v_staff || p_coordinator) u(id)
  where u.id is not null and u.id is distinct from auth.uid()
    and u.id is distinct from v.coordinator_id
    and not exists (select 1 from public.project_staff s where s.project_id = p_id and s.user_id = u.id);

  update public.projects set coordinator_id = p_coordinator where id = p_id;
  delete from public.project_staff where project_id = p_id and not (user_id = any (v_staff));
  insert into public.project_staff (project_id, user_id)
  select p_id, u.id from unnest(v_staff) u(id) where u.id is not null
  on conflict do nothing;

  insert into public.notifications (user_id, type, title, body, link)
  select u.id, 'project_assigned', 'You were added to a project', v.name, '/admin/projects/' || p_id
  from unnest(coalesce(v_new, '{}')) u(id);
end $$;

-- Clients see their coordinator's name only (no email or phone).
create function public.project_coordinators(p_org uuid)
returns table (project_id uuid, coordinator text)
language sql stable security definer set search_path = '' as $$
  select pr.id, coalesce(nullif(trim(p.full_name), ''), 'Atlas team')
  from public.projects pr join public.profiles p on p.id = pr.coordinator_id
  where pr.organization_id = p_org and (public.is_staff() or public.is_org_member(p_org));
$$;

-- ---------------------------------------------------------------
-- Service requests: clients raise, coordinator and above answer.
-- ---------------------------------------------------------------
create function public.raise_service_request(p_org uuid, p_project uuid, p_subject text, p_description text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_org text;
begin
  if not coalesce(public.is_org_member(p_org), false) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_project is not null and not exists (select 1 from public.projects where id = p_project and organization_id = p_org) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into public.service_requests (organization_id, project_id, subject, description, created_by)
  values (p_org, p_project, trim(p_subject), trim(p_description), auth.uid())
  returning id into v_id;

  select name into v_org from public.organizations where id = p_org;
  insert into public.notifications (user_id, type, title, body, link)
  select distinct p.id, 'service_request', 'New request: ' || v_org, left(trim(p_subject), 200), '/admin/requests'
  from public.profiles p
  where p.is_active and p.staff_role is not null
    and (p.staff_role in ('SUPER_ADMIN', 'ADMIN')
         or p.id = (select coordinator_id from public.projects where id = p_project));
  return v_id;
end $$;

create function public.answer_service_request(p_id uuid, p_status public.service_request_status, p_reply text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.service_requests;
  v_reply text := left(nullif(trim(coalesce(p_reply, '')), ''), 4000);
begin
  if not coalesce(public.staff_role() in ('SUPER_ADMIN', 'ADMIN', 'PROJECT_COORDINATOR'), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v from public.service_requests where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  update public.service_requests
  set status = p_status,
      reply = coalesce(v_reply, reply),
      replied_by = case when v_reply is not null then auth.uid() else replied_by end,
      replied_at = case when v_reply is not null then now() else replied_at end
  where id = p_id;

  perform public.notify_org_members(v.organization_id, 'service_request_update', 'Atlas replied: ' || v.subject,
    coalesce(left(v_reply, 300), 'Status: ' || replace(p_status::text, '_', ' ') || '.'), '/portal/requests');
end $$;

revoke execute on function public.can_manage_project, public.set_project_status, public.set_project_team,
  public.project_coordinators, public.raise_service_request, public.answer_service_request from public, anon;
grant execute on function public.can_manage_project, public.set_project_status, public.set_project_team,
  public.project_coordinators, public.raise_service_request, public.answer_service_request to authenticated;
revoke execute on function public.project_no_delete, public.task_before_write, public.create_agreement_projects
  from public, anon, authenticated;

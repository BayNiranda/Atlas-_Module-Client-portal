-- The database checks answers against the questionnaire version itself, so a
-- client calling save/submit directly (bypassing the website) cannot store
-- invalid answers or submit with required questions missing.

-- Returns NULL if valid, otherwise a short problem code naming the question.
create function public.assessment_answers_problem(p_def jsonb, p_answers jsonb, p_require boolean)
returns text
language plpgsql immutable set search_path = '' as $$
declare
  q jsonb;
  k text;
  val jsonb;
  qid text;
  qtype text;
  opts jsonb;
  item jsonb;
  maxlen int;
begin
  if jsonb_typeof(p_answers) <> 'object' then return 'bad_format'; end if;

  -- Every key must be a real question (or its "other" text).
  for k, val in select * from jsonb_each(p_answers) loop
    qid := split_part(k, ':', 1);
    select x into q from jsonb_array_elements(p_def -> 'sections') s, jsonb_array_elements(s -> 'questions') x
    where x ->> 'id' = qid;
    if q is null then return 'unknown_question:' || k; end if;
    if k like '%:other' then
      if q ->> 'other' is null or jsonb_typeof(val) <> 'string' or length(val #>> '{}') > 200 then return 'bad_other:' || qid; end if;
      continue;
    end if;
    if k <> qid then return 'unknown_question:' || k; end if;

    qtype := q ->> 'type';
    opts := q -> 'options';
    maxlen := coalesce((q ->> 'max')::int, 1000);
    if qtype = 'checkbox' then
      if jsonb_typeof(val) <> 'array' then return 'bad_value:' || qid; end if;
      for item in select * from jsonb_array_elements(val) loop
        if jsonb_typeof(item) <> 'string' or not (opts ? (item #>> '{}')) then return 'bad_option:' || qid; end if;
      end loop;
    elsif jsonb_typeof(val) <> 'string' then
      return 'bad_value:' || qid;
    elsif qtype in ('select', 'radio') then
      if not (opts ? (val #>> '{}')) then return 'bad_option:' || qid; end if;
    elsif qtype = 'scale' then
      if (val #>> '{}') !~ '^[0-9]+$' or (val #>> '{}')::int not between (q ->> 'min')::int and (q ->> 'max')::int then
        return 'bad_value:' || qid;
      end if;
    elsif qtype = 'consent' then
      if (val #>> '{}') <> 'yes' then return 'bad_value:' || qid; end if;
    elsif qtype in ('short_text', 'long_text', 'email', 'phone') then
      if length(val #>> '{}') > (case when qtype in ('email', 'phone') then 254 else maxlen end) then return 'too_long:' || qid; end if;
    else
      return 'bad_value:' || qid;
    end if;
  end loop;

  -- On submit, every required question must have a non-empty answer.
  if p_require then
    for q in select x from jsonb_array_elements(p_def -> 'sections') s, jsonb_array_elements(s -> 'questions') x loop
      if (q ->> 'required')::boolean then
        val := p_answers -> (q ->> 'id');
        if val is null or (jsonb_typeof(val) = 'string' and trim(val #>> '{}') = '')
           or (jsonb_typeof(val) = 'array' and jsonb_array_length(val) = 0) then
          return 'missing:' || (q ->> 'id');
        end if;
      end if;
    end loop;
  end if;
  return null;
end $$;

create or replace function public.save_assessment(p_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.assessments;
  v_problem text;
begin
  select * into v from public.assessments where id = p_id for update;
  if not found or not coalesce(public.is_org_member(v.organization_id), false) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v.status not in ('not_started', 'in_progress', 'changes_requested') then
    raise exception 'not_editable' using errcode = 'P0001';
  end if;
  select public.assessment_answers_problem(t.definition, p_answers, false) into v_problem
  from public.assessment_template_versions t where t.id = v.template_version_id;
  if v_problem is not null then raise exception 'invalid_answers %', v_problem using errcode = 'P0001'; end if;

  update public.assessments
  set answers = p_answers, updated_by = auth.uid(),
      status = case when v.status = 'not_started' then 'in_progress'::public.assessment_status else v.status end
  where id = p_id;
end $$;

create or replace function public.submit_assessment(p_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.assessments;
  v_problem text;
begin
  perform public.save_assessment(p_id, p_answers);
  select * into v from public.assessments where id = p_id;
  select public.assessment_answers_problem(t.definition, p_answers, true) into v_problem
  from public.assessment_template_versions t where t.id = v.template_version_id;
  if v_problem is not null then raise exception 'invalid_answers %', v_problem using errcode = 'P0001'; end if;

  update public.assessments
  set status = 'submitted', submitted_at = now(), submitted_by = auth.uid(), review_comment = null
  where id = p_id;

  insert into public.notifications (user_id, type, title, body, link)
  select distinct p.id, 'assessment_submitted', 'Pre-assessment submitted: ' || o.name,
         'Ready for review.', '/admin/assessments/' || p_id
  from public.organizations o
  left join public.inquiries i on i.id = o.source_inquiry_id
  join public.profiles p on p.is_active and p.staff_role is not null
       and (p.id = i.assigned_to or p.staff_role in ('SUPER_ADMIN', 'ADMIN'))
  where o.id = v.organization_id;
end $$;

revoke execute on function public.assessment_answers_problem from public, anon, authenticated;

-- Replace a draft's fee lines in one step (all or nothing), so a failed save
-- never leaves a draft with half its lines. Runs as the caller ("security
-- invoker"), so RLS and the lock triggers still apply: drafts only, staff only.
create function public.replace_proposal_items(p_id uuid, p_items jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.proposal_items where proposal_id = p_id;
  insert into public.proposal_items (proposal_id, service_id, title, scope, deliverables, billing, amount, sort_order)
  select p_id, nullif(e ->> 'service_id', '')::uuid, e ->> 'title', nullif(e ->> 'scope', ''),
         nullif(e ->> 'deliverables', ''), (e ->> 'billing')::public.billing_type, (e ->> 'amount')::numeric, t.ord::int
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);
end $$;
revoke execute on function public.replace_proposal_items from public, anon;
grant execute on function public.replace_proposal_items to authenticated;

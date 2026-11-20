-- Files uploaded by Atlas staff (shared reports, internal files) need no review:
-- they start as "accepted". Client uploads still start as "received".
create or replace function public.set_staff_document_accepted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.is_staff(), false) then
    new.status := 'accepted';
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger documents_staff_accepted before insert on public.documents
  for each row execute function public.set_staff_document_accepted();
revoke execute on function public.set_staff_document_accepted from public, anon, authenticated;

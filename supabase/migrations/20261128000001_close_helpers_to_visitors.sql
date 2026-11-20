-- Security review (Module 9A): the permission-check helpers were callable by
-- logged-out visitors. They only ever answered "no", but nobody outside needs
-- them. Close them to visitors; signed-in users and the database keep them.

-- Visitors read published services without the staff check (which they can no
-- longer call); signed-in staff also see unpublished ones.
drop policy services_public_select on public.services;
create policy services_anon_select on public.services for select to anon
  using (is_public and is_active);
create policy services_select on public.services for select to authenticated
  using ((is_public and is_active) or public.is_staff());

revoke execute on function public.is_staff, public.staff_role, public.is_org_member, public.is_org_owner,
  public.shares_org_with, public.audit_actor_role from public, anon;
grant execute on function public.is_staff, public.staff_role, public.is_org_member, public.is_org_owner,
  public.shares_org_with, public.audit_actor_role to authenticated, service_role;

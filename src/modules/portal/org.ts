import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ORG_COOKIE = "portal_org";

export type Membership = { orgId: string; orgName: string; role: "CLIENT_OWNER" | "CLIENT_MEMBER" };

// The person's active memberships, read through RLS (only their own).
export const getMemberships = cache(async (userId: string): Promise<Membership[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return (data as unknown as { role: Membership["role"]; organizations: { id: string; name: string } | null }[])
    .filter((m) => m.organizations)
    .map((m) => ({ orgId: m.organizations!.id, orgName: m.organizations!.name, role: m.role }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
});

// The company the portal is showing. The cookie is only a preference: it is
// accepted only if it matches one of the person's own memberships.
export async function getCurrentOrg(userId: string) {
  const memberships = await getMemberships(userId);
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.orgId === wanted) ?? memberships[0] ?? null;
  return { current, memberships };
}

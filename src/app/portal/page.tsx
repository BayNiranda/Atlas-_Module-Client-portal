import { requireClient } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalHome() {
  const user = await requireClient();
  const supabase = await createClient();
  // RLS only returns organizations this user is an active member of.
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Welcome</h1>
      {memberships?.length ? (
        <ul className="space-y-2 text-sm">
          {memberships.map((m) => {
            const org = m.organizations as unknown as { id: string; name: string } | null;
            return (
              <li key={org?.id} className="rounded-md border border-neutral-200 px-4 py-3">
                {org?.name} <span className="text-neutral-500">· {m.role === "CLIENT_OWNER" ? "Owner" : "Member"}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-600">Your account is not linked to an organization yet.</p>
      )}
    </>
  );
}

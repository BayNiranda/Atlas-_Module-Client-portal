import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/modules/portal/org";
import { removeColleague } from "@/modules/portal/actions";
import { ActionForm } from "@/components/action-form";
import { InviteColleagueForm } from "./invite-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function ColleaguesPage() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");
  const isOwner = current.role === "CLIENT_OWNER";

  // RLS: members see their own company's members, and (new rule) their names.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, status, profiles(full_name, email)")
    .eq("organization_id", current.orgId)
    .eq("status", "active")
    .order("role");
  if (error) throw error;
  const members = data as unknown as { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null }[];

  return (
    <>
      <div className="top">
        <div>
          <h1>Colleagues</h1>
          <div className="sub">People at {current.orgName} who can use this portal.</div>
        </div>
      </div>

      <div className="tbl" style={{ marginBottom: 22, maxWidth: 860 }}>
        <table>
          <thead><tr><th>Name</th><th>Access</th>{isOwner && <th></th>}</tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td><b>{m.profiles?.full_name ?? m.profiles?.email}</b><small>{m.profiles?.email}</small></td>
                <td>{m.role === "CLIENT_OWNER" ? "Owner" : "Member"}{m.user_id === user.id ? " (you)" : ""}</td>
                {isOwner && (
                  <td>
                    {m.user_id !== user.id && (
                      <ActionForm action={removeColleague} submit="Remove access" className="inline-status">
                        <input type="hidden" name="user_id" value={m.user_id} />
                      </ActionForm>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOwner ? (
        <div className="panel" style={{ maxWidth: 860 }}>
          <h3>Add a colleague</h3>
          <InviteColleagueForm company={current.orgName} />
        </div>
      ) : (
        <p className="muted">Ask an owner of {current.orgName} to add or remove colleagues.</p>
      )}
    </>
  );
}

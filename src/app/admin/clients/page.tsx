import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

const STATUS_TONE: Record<string, string> = { active: "green", prospect: "gold", inactive: "grey" };

export default async function ClientsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, status, created_at, source:inquiries!organizations_source_inquiry_id_fkey(id, reference), organization_members(role, status, profiles(full_name, email))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const orgs = data as unknown as {
    id: string; name: string; status: string; created_at: string;
    source: { id: string; reference: string } | null;
    organization_members: { role: string; status: string; profiles: { full_name: string | null; email: string | null } | null }[];
  }[];

  return (
    <>
      <div className="top">
        <div>
          <h1>Clients</h1>
          <div className="sub">Client organizations and their portal users. Proposals, agreements and projects appear here in later modules.</div>
        </div>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Organization</th><th>Portal users</th><th>From inquiry</th><th>Since</th><th>Status</th></tr></thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td><Link className="row" href={`/admin/clients/${o.id}`}>{o.name}</Link><small><Link href={`/admin/proposals/new?org=${o.id}`}>New proposal</Link></small></td>
                <td>
                  {o.organization_members.map((m, idx) => (
                    <small key={idx}>
                      {m.profiles?.full_name ?? m.profiles?.email} · {m.role === "CLIENT_OWNER" ? "Owner" : "Member"}{m.status !== "active" ? ` (${m.status})` : ""}
                    </small>
                  ))}
                </td>
                <td>{o.source ? <Link href={`/admin/inquiries/${o.source.id}`}>{o.source.reference}</Link> : "—"}</td>
                <td>{fmtDate(o.created_at)}</td>
                <td><span className={`st ${STATUS_TONE[o.status] ?? "grey"}`}>{o.status[0].toUpperCase() + o.status.slice(1)}</span></td>
              </tr>
            ))}
            {!orgs.length && <tr><td colSpan={5} className="muted">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

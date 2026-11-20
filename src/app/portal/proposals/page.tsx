import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { getCurrentOrg } from "@/modules/portal/org";
import { listProposals } from "@/modules/proposals/queries";
import { displayStatus, proposalRef, STATUS_LABEL, statusTone } from "@/modules/proposals/labels";
import { fmtDate } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalProposals() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");
  // RLS: only this person's companies, never drafts.
  const rows = await listProposals({ orgId: current.orgId });

  return (
    <>
      <div className="top">
        <div>
          <h1>Proposals</h1>
          <div className="sub">Prepared after Atlas has assessed the scope of work with you.</div>
        </div>
      </div>
      {rows.length ? (
        <div className="tbl" style={{ maxWidth: 880 }}>
          <table>
            <thead><tr><th>Proposal</th><th>Title</th><th>Valid until</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const s = displayStatus(p);
                return (
                  <tr key={p.id}>
                    <td><Link className="row" href={`/portal/proposals/${p.id}`}>{proposalRef(p)}</Link></td>
                    <td>{p.title}</td>
                    <td>{fmtDate(p.valid_until)}</td>
                    <td><span className={`st ${statusTone(s)}`}>{STATUS_LABEL[s]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 640 }}>
          <h3>No proposal yet</h3>
          <p style={{ margin: 0 }}>Atlas prepares your proposal after reviewing the scope of work with you, so the fees and deliverables match what you actually need.</p>
        </div>
      )}
    </>
  );
}

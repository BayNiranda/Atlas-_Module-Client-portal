import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { getCurrentOrg } from "@/modules/portal/org";
import { AGREEMENT_STATUS, agreementRef, agreementTone, listAgreements } from "@/modules/agreements/queries";
import { fmtDate } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalAgreements() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");
  const rows = await listAgreements({ orgId: current.orgId }); // RLS: never drafts

  return (
    <>
      <div className="top">
        <div>
          <h1>Agreements</h1>
          <div className="sub">Prepared from your accepted proposal. Signed agreements are stored unchanged; amendments become new versions.</div>
        </div>
      </div>
      {rows.length ? (
        <div className="tbl" style={{ maxWidth: 880 }}>
          <table>
            <thead><tr><th>Agreement</th><th>Title</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><Link className="row" href={`/portal/agreements/${a.id}`}>{agreementRef(a)}</Link></td>
                  <td>{a.title}</td>
                  <td>{fmtDate(a.created_at)}</td>
                  <td><span className={`st ${agreementTone(a.status)}`}>{AGREEMENT_STATUS[a.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 640 }}>
          <h3>No agreement yet</h3>
          <p style={{ margin: 0 }}>The agreement is prepared after you accept a proposal.</p>
        </div>
      )}
    </>
  );
}

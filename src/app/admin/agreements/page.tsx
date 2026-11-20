import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { AGREEMENT_STATUS, agreementRef, agreementTone, listAgreements } from "@/modules/agreements/queries";
import { fmtDate } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AgreementsPage() {
  await requireStaff();
  const rows = await listAgreements();
  return (
    <>
      <div className="top">
        <div>
          <h1>Agreements</h1>
          <div className="sub">Prepared from accepted proposals. Signed by print, signature and company seal, then uploaded. Signed agreements can never be changed.</div>
        </div>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Agreement</th><th>Client</th><th>Title</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><Link className="row" href={`/admin/agreements/${a.id}`}>{agreementRef(a)}</Link></td>
                <td>{a.organization?.name}</td>
                <td>{a.title}</td>
                <td>{fmtDate(a.created_at)}</td>
                <td><span className={`st ${agreementTone(a.status)}`}>{AGREEMENT_STATUS[a.status]}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">No agreements yet. Prepare one from an accepted proposal.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

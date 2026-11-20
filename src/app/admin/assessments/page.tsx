import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { ASSESSMENT_STATUS, assessmentTone, listAssessments } from "@/modules/assessments/queries";
import { fmtDateTime } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

// Submitted ones first: they are waiting for Atlas.
const ORDER = ["submitted", "changes_requested", "in_progress", "not_started", "approved"];

export default async function AssessmentsPage() {
  await requireStaff();
  const rows = (await listAssessments()).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <>
      <div className="top">
        <div>
          <h1>Pre-assessments</h1>
          <div className="sub">Filled in by clients in the portal. A proposal can be sent only after the pre-assessment is approved.</div>
        </div>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Client</th><th>Status</th><th>Submitted</th><th>Reviewed</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><Link className="row" href={`/admin/assessments/${a.id}`}>{a.organization?.name}</Link></td>
                <td><span className={`st ${assessmentTone(a.status)}`}>{ASSESSMENT_STATUS[a.status]}</span></td>
                <td>{a.submitted_at ? fmtDateTime(a.submitted_at) : "—"}</td>
                <td>{a.reviewed_at ? fmtDateTime(a.reviewed_at) : "—"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="muted">No client companies yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

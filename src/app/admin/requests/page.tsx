import Link from "next/link";
import { MANAGERS, requireStaff } from "@/lib/auth/guards";
import { listServiceRequests } from "@/modules/projects/queries";
import { answerServiceRequest } from "@/modules/projects/actions";
import { REQUEST_STATUS, requestStatusLabel, requestTone } from "@/modules/projects/labels";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function RequestsPage() {
  const user = await requireStaff();
  const requests = await listServiceRequests();
  const canAnswer = MANAGERS.includes(user.staffRole);
  const open = requests.filter((r) => r.status === "open" || r.status === "in_review");
  const done = requests.filter((r) => !open.includes(r));

  const card = (r: (typeof requests)[number]) => (
    <div key={r.id} className="request">
      <div className="request-head">
        <div>
          <b>{r.subject}</b>
          <small>
            <Link href={`/admin/clients/${r.organization_id}`}>{r.organization?.name}</Link>
            {r.project && <> · <Link href={`/admin/projects/${r.project_id}`}>{r.project.name}</Link></>}
            {" · "}{personName(r.author)} · {fmtDateTime(r.created_at)}
          </small>
          <small className="challenge">{r.description}</small>
          {r.reply && <small><b>Atlas replied:</b> {r.reply}</small>}
        </div>
        <span className={`st ${requestTone(r.status)}`}>{requestStatusLabel(r.status)}</span>
      </div>
      {canAnswer && (
        <details>
          <summary className="btn btn-o btn-sm">Reply / update…</summary>
          <ActionForm action={answerServiceRequest} submit="Save">
            <input type="hidden" name="id" value={r.id} />
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor={`st-${r.id}`}>Status</label>
              <select id={`st-${r.id}`} name="status" defaultValue={r.status === "open" ? "in_review" : r.status}>
                {REQUEST_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor={`re-${r.id}`}>Reply to the client <span className="opt">(optional; replaces the previous reply)</span></label>
              <textarea id={`re-${r.id}`} name="reply" maxLength={4000} />
            </div>
          </ActionForm>
        </details>
      )}
    </div>
  );

  return (
    <>
      <div className="top">
        <div>
          <h1>Client requests</h1>
          <div className="sub">Things clients ask for through the portal. {canAnswer ? "" : "Coordinators and admins answer them."}</div>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 980 }}>
        <h3>Waiting for Atlas ({open.length})</h3>
        {open.length ? open.map(card) : <p className="muted" style={{ margin: 0 }}>Nothing waiting.</p>}
      </div>
      <div className="panel" style={{ maxWidth: 980 }}>
        <h3>Resolved and closed</h3>
        {done.length ? done.map(card) : <p className="muted" style={{ margin: 0 }}>None yet.</p>}
      </div>
    </>
  );
}

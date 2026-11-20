import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { getCurrentOrg } from "@/modules/portal/org";
import { listProjects, listServiceRequests } from "@/modules/projects/queries";
import { raiseServiceRequest } from "@/modules/projects/actions";
import { requestStatusLabel, requestTone } from "@/modules/projects/labels";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalRequests() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");
  const [requests, projects] = await Promise.all([listServiceRequests({ orgId: current.orgId }), listProjects({ orgId: current.orgId })]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Requests</h1>
          <div className="sub">Ask Atlas for something new or extra. We reply here and you get a notification.</div>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="panel">
            <h3>Your requests</h3>
            {requests.length ? requests.map((r) => (
              <div key={r.id} className="request">
                <div className="request-head">
                  <div>
                    <b>{r.subject}</b>
                    <small>{r.project ? `${r.project.name} · ` : ""}{fmtDateTime(r.created_at)}</small>
                    <small className="challenge">{r.description}</small>
                    {r.reply && <small className="challenge"><b>Atlas:</b> {r.reply}</small>}
                  </div>
                  <span className={`st ${requestTone(r.status)}`}>{requestStatusLabel(r.status)}</span>
                </div>
              </div>
            )) : <p className="muted" style={{ margin: 0 }}>No requests yet.</p>}
          </div>
        </div>

        <div>
          <div className="panel">
            <h3>New request</h3>
            <ActionForm action={raiseServiceRequest} submit="Send to Atlas">
              <input type="hidden" name="org_id" value={current.orgId} />
              <div className="field">
                <label htmlFor="subject">Subject</label>
                <input id="subject" name="subject" maxLength={200} required />
              </div>
              {projects.length > 0 && (
                <div className="field" style={{ marginTop: 8 }}>
                  <label htmlFor="project_id">About <span className="opt">(optional)</span></label>
                  <select id="project_id" name="project_id" defaultValue="">
                    <option value="">Something new</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="description">What do you need?</label>
                <textarea id="description" name="description" maxLength={4000} required />
                <small className="muted">Please do not include passwords or bank account numbers.</small>
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}

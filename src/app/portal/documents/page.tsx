import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/modules/portal/org";
import { hasSignedAgreement, listDocuments, listRequests } from "@/modules/documents/queries";
import { type Category, categoryLabel, REQUEST_STATUS, requestTone } from "@/modules/documents/labels";
import { fmtDate } from "@/modules/inquiries/labels";
import { DocumentRow } from "@/components/document-row";
import { DocumentUpload } from "@/components/document-upload";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalDocuments() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");

  const supabase = await createClient();
  const [requests, docs, open, members] = await Promise.all([
    listRequests(current.orgId),
    listDocuments({ orgId: current.orgId }), // RLS: never internal files
    hasSignedAgreement(current.orgId),
    supabase.from("organization_members").select("user_id").eq("organization_id", current.orgId),
  ]);
  const colleagues = new Set((members.data ?? []).map((m) => m.user_id));
  const fromAtlas = docs.filter((d) => !colleagues.has(d.uploaded_by));
  const ours = docs.filter((d) => colleagues.has(d.uploaded_by));
  const byRequest = (id: string) => ours.filter((d) => d.request_id === id);
  const others = ours.filter((d) => !d.request_id);

  return (
    <>
      <div className="top">
        <div>
          <h1>Documents</h1>
          <div className="sub">Stored privately. Downloads use links that expire after a minute, and every download is recorded.</div>
        </div>
      </div>

      {!open && (
        <div className="note-box" role="status">
          Document uploads open once your agreement with Atlas is signed. Until then, please do not send financial documents
          by any other channel either.
        </div>
      )}

      <div className="panel" style={{ maxWidth: 980 }}>
        <h3>Requested by Atlas</h3>
        {requests.filter((r) => r.status !== "cancelled").length ? (
          requests.filter((r) => r.status !== "cancelled").map((r) => (
            <div key={r.id} className="request">
              <div className="request-head">
                <div>
                  <b>{r.title}</b>
                  <small>{categoryLabel(r.category)}{r.due_date ? ` · due ${fmtDate(r.due_date)}` : ""}</small>
                  {r.note && <small className="challenge">{r.note}</small>}
                </div>
                <span className={`st ${requestTone(r.status)}`}>{REQUEST_STATUS[r.status]}</span>
              </div>
              {byRequest(r.id).map((d) => <DocumentRow key={d.id} d={d} />)}
              {r.status === "open" && open && (
                <details>
                  <summary className="btn btn-o btn-sm">Upload for this request</summary>
                  <div style={{ marginTop: 10 }}>
                    <DocumentUpload orgId={current.orgId} requestId={r.id} category={r.category as Category} inputId={`req-${r.id}`} />
                  </div>
                </details>
              )}
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: 0 }}>Nothing requested yet.</p>
        )}
      </div>

      <div className="panel" style={{ maxWidth: 980 }}>
        <h3>Shared by Atlas</h3>
        {fromAtlas.length ? fromAtlas.map((d) => <DocumentRow key={d.id} d={d} showStatus={false} />) : <p className="muted" style={{ margin: 0 }}>Nothing shared yet.</p>}
      </div>

      <div className="panel" style={{ maxWidth: 980 }}>
        <h3>Other uploads</h3>
        {others.map((d) => <DocumentRow key={d.id} d={d} />)}
        {open ? (
          <details style={{ marginTop: others.length ? 12 : 0 }}>
            <summary className="btn btn-o btn-sm">Upload another document</summary>
            <div style={{ marginTop: 10 }}><DocumentUpload orgId={current.orgId} inputId="other-upload" /></div>
          </details>
        ) : (
          !others.length && <p className="muted" style={{ margin: 0 }}>None.</p>
        )}
      </div>
    </>
  );
}

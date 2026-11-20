import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { hasSignedAgreement, listDocuments, listRequests } from "@/modules/documents/queries";
import { cancelDocumentRequest, requestDocument } from "@/modules/documents/actions";
import { CATEGORIES, categoryLabel, REQUEST_STATUS, requestTone } from "@/modules/documents/labels";
import { fmtDate } from "@/modules/inquiries/labels";
import { ActionForm } from "@/components/action-form";
import { DocumentRow } from "@/components/document-row";
import { DocumentUpload } from "@/components/document-upload";
import { ReviewDocument } from "../../_components/review-document";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, name").eq("id", id).maybeSingle();
  if (!org) notFound();

  const [requests, docs, signed] = await Promise.all([listRequests(id), listDocuments({ orgId: id }), hasSignedAgreement(id)]);
  const forRequest = (rid: string) => docs.filter((d) => d.request_id === rid);
  const others = docs.filter((d) => !d.request_id);

  return (
    <>
      <p className="muted"><Link href="/admin/clients">← All clients</Link></p>
      <div className="top">
        <div>
          <h1>{org.name}</h1>
          <div className="sub">
            Documents · {signed ? "Agreement signed: the client can upload." : "No signed agreement yet: only Atlas can upload for now."}
          </div>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          <Link className="btn btn-o btn-sm" href={`/admin/proposals/new?org=${org.id}`}>New proposal</Link>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="panel">
            <h3>Requested documents</h3>
            {requests.length ? requests.map((r) => (
              <div key={r.id} className="request">
                <div className="request-head">
                  <div>
                    <b>{r.title}</b>
                    <small>{categoryLabel(r.category)}{r.due_date ? ` · due ${fmtDate(r.due_date)}` : ""}</small>
                    {r.note && <small className="challenge">{r.note}</small>}
                  </div>
                  <span className={`st ${requestTone(r.status)}`}>{REQUEST_STATUS[r.status]}</span>
                </div>
                {forRequest(r.id).map((d) => (
                  <DocumentRow key={d.id} d={d}>{d.status === "received" && <ReviewDocument id={d.id} />}</DocumentRow>
                ))}
                {r.status === "open" && (
                  <ActionForm action={cancelDocumentRequest} submit="Cancel request" className="inline-status">
                    <input type="hidden" name="id" value={r.id} />
                  </ActionForm>
                )}
              </div>
            )) : <p className="muted" style={{ margin: 0 }}>No requests yet.</p>}
          </div>

          <div className="panel">
            <h3>Other files</h3>
            {others.length ? others.map((d) => (
              <DocumentRow key={d.id} d={d}>{d.status === "received" && <ReviewDocument id={d.id} />}</DocumentRow>
            )) : <p className="muted" style={{ margin: 0 }}>None.</p>}
          </div>
        </div>

        <div>
          <div className="internal">
            <b>REQUEST A DOCUMENT</b>
            <ActionForm action={requestDocument} submit="Send request">
              <input type="hidden" name="org_id" value={org.id} />
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="title">Document</label>
                <input id="title" name="title" maxLength={200} placeholder="e.g. Bank statements Aug–Oct 2026" required />
              </div>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <select id="category" name="category" defaultValue="other">
                    {CATEGORIES.filter(([k]) => k !== "atlas_reports").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="due_date">Due date <span className="opt">(optional)</span></label>
                  <input id="due_date" name="due_date" type="date" />
                </div>
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="note">Note for the client <span className="opt">(optional)</span></label>
                <textarea id="note" name="note" maxLength={2000} />
              </div>
            </ActionForm>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Upload a file</h3>
            <p className="muted">Share a report with the client, or keep an internal file only Atlas can see.</p>
            <DocumentUpload orgId={org.id} staff inputId="staff-upload" />
          </div>
        </div>
      </div>
    </>
  );
}

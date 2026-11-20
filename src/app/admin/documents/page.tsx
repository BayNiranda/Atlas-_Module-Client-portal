import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { listDocuments } from "@/modules/documents/queries";
import { DocumentRow } from "@/components/document-row";
import { ReviewDocument } from "../_components/review-document";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function DocumentsReview() {
  await requireStaff();
  const waiting = await listDocuments({ status: "received" });

  return (
    <>
      <div className="top">
        <div>
          <h1>Documents</h1>
          <div className="sub">Uploads from clients waiting for review. Open a client from <Link href="/admin/clients">Clients</Link> to request documents or share files.</div>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 980 }}>
        <h3>Waiting for review ({waiting.length})</h3>
        {waiting.length ? waiting.map((d) => (
          <DocumentRow key={d.id} d={d} showStatus={false}>
            <small>
              <Link href={`/admin/clients/${d.organization_id}`}>{d.organization?.name}</Link>
              {d.request && <> · for request: {d.request.title}</>}
            </small>
            <ReviewDocument id={d.id} />
          </DocumentRow>
        )) : <p className="muted" style={{ margin: 0 }}>Nothing waiting.</p>}
      </div>
    </>
  );
}

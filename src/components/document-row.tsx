import type { Doc } from "@/modules/documents/queries";
import { categoryLabel, DOC_STATUS, docTone, fmtSize } from "@/modules/documents/labels";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";

// One stored file: name, details, review status, and a download link (each
// click is permission-checked, logged, and gets a 60-second link).
export function DocumentRow({ d, showStatus = true, children }: { d: Doc; showStatus?: boolean; children?: React.ReactNode }) {
  return (
    <div className="file-row">
      <div style={{ minWidth: 0 }}>
        <b>{d.file_name}</b>{" "}
        {d.visibility === "internal" && <span className="st grey">Internal</span>}
        <small>
          {categoryLabel(d.category)} · {fmtSize(d.size_bytes)} · {fmtDateTime(d.created_at)}
          {d.uploader ? ` · ${personName(d.uploader)}` : " · Atlas"}
        </small>
        {showStatus && (
          <small>
            <span className={`st ${docTone(d.status)}`}>{DOC_STATUS[d.status]}</span>
            {d.status === "rejected" && d.review_note && <> {d.review_note}</>}
          </small>
        )}
        {children}
      </div>
      <a className="btn btn-o btn-sm" href={`/documents/${d.id}/file`}>Download</a>
    </div>
  );
}

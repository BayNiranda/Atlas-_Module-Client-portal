import type { Agreement } from "@/modules/agreements/queries";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";

// The stored scans, with download links (each click creates a 60-second link
// after a permission check) and their fingerprints for verification.
export function AgreementFiles({ a }: { a: Agreement }) {
  const rows = [
    { kind: "client", label: "Signed by the client", name: a.client_file_name, at: a.client_uploaded_at, by: a.client_uploader, sha: a.client_file_sha256 },
    { kind: "signed", label: "Signed by both parties", name: a.signed_file_name, at: a.signed_uploaded_at, by: a.signed_uploader, sha: a.signed_file_sha256 },
  ].filter((r) => r.name);
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>No signed copies uploaded yet.</p>;
  return (
    <div>
      {rows.map((r) => (
        <div className="file-row" key={r.kind}>
          <div>
            <b>{r.label}</b>
            <small>{r.name} · uploaded {r.at ? fmtDateTime(r.at) : ""} by {personName(r.by)}</small>
            <small title="Digital fingerprint (SHA-256). Any change to the file would change it.">Fingerprint: {r.sha?.slice(0, 16)}…</small>
          </div>
          <a className="btn btn-o btn-sm" href={`/agreements/${a.id}/file?kind=${r.kind}`}>Download</a>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { AGREEMENT_STATUS, agreementRef, agreementTone, getAgreement } from "@/modules/agreements/queries";
import {
  confirmAgreementSigned, deleteAgreementDraft, issueAgreement, newAgreementVersion, saveAgreementDraft, voidAgreement,
} from "@/modules/agreements/actions";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";
import { AgreementDocument } from "@/components/agreement-document";
import { AgreementFiles } from "@/components/agreement-files";
import { AgreementUpload } from "@/components/agreement-upload";
import { PrintButton } from "@/components/print-button";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AgreementPage({ params }: PageProps<"/admin/agreements/[id]">) {
  const user = await requireStaff();
  const a = await getAgreement((await params).id);
  if (!a) notFound();
  const isAdmin = user.staffRole === "SUPER_ADMIN" || user.staffRole === "ADMIN";
  const open = a.status === "issued" || a.status === "client_signed";

  return (
    <>
      <p className="muted no-print"><Link href="/admin/agreements">← All agreements</Link> · <Link href={`/admin/proposals/${a.proposal_id}`}>Proposal</Link></p>
      <div className="top">
        <div>
          <h1>{agreementRef(a)} · {a.organization?.name}</h1>
          <span className={`st ${agreementTone(a.status)}`}>{AGREEMENT_STATUS[a.status]}</span>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          <PrintButton label="Print / Save as PDF" />
          {["issued", "client_signed", "signed", "voided"].includes(a.status) && (
            <ActionForm action={newAgreementVersion} submit={a.status === "signed" ? "Amend (new version)" : "New version"} className="inline-status">
              <input type="hidden" name="id" value={a.id} />
            </ActionForm>
          )}
        </div>
      </div>

      <div className="cols">
        <AgreementDocument a={a} />
        <div className="no-print">
          {a.status === "draft" && (
            <>
              <div className="panel">
                <h3>Edit draft</h3>
                <p className="muted">The standard articles come from Atlas&apos;s template. Scope and fees come from the accepted proposal.</p>
                <ActionForm action={saveAgreementDraft} submit="Save draft">
                  <input type="hidden" name="id" value={a.id} />
                  <div className="field full"><label htmlFor="title">Title</label><input id="title" name="title" defaultValue={a.title} maxLength={200} required /></div>
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <div className="field"><label htmlFor="start_date">Engagement starts</label><input id="start_date" name="start_date" type="date" defaultValue={a.start_date} required /></div>
                    <div className="field"><label htmlFor="end_date">Engagement ends</label><input id="end_date" name="end_date" type="date" defaultValue={a.end_date} required /></div>
                  </div>
                  <h3 style={{ marginTop: 14 }}>Service names in Lao</h3>
                  {a.content.items.map((it, i) => (
                    <div className="field" key={i} style={{ marginBottom: 8 }}>
                      <label htmlFor={`item_lo_${i}`}>{it.title}</label>
                      <input id={`item_lo_${i}`} name={`item_lo_${i}`} lang="lo" defaultValue={it.title_lo} maxLength={300} />
                    </div>
                  ))}
                  <div className="field" style={{ marginTop: 8 }}><label htmlFor="payment_lo">Payment schedule (Lao)</label><textarea id="payment_lo" name="payment_lo" lang="lo" defaultValue={a.content.payment_terms.lo} maxLength={5000} /></div>
                  <div className="field" style={{ marginTop: 8 }}><label htmlFor="payment_en">Payment schedule (English)</label><textarea id="payment_en" name="payment_en" defaultValue={a.content.payment_terms.en} maxLength={5000} /></div>
                </ActionForm>
              </div>
              <div className="internal" style={{ marginTop: 16 }}>
                <b>ISSUE FOR SIGNING</b>
                {isAdmin ? (
                  <ActionForm action={issueAgreement} submit="Issue for signing">
                    <input type="hidden" name="id" value={a.id} />
                    <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>Save your changes first. Once issued, the text is locked and the client is asked to sign.</p>
                  </ActionForm>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>Only an Admin or Super admin can issue agreements.</p>
                )}
              </div>
              <div className="panel" style={{ marginTop: 16 }}>
                <ActionForm action={deleteAgreementDraft} submit="Delete this draft"><input type="hidden" name="id" value={a.id} /></ActionForm>
              </div>
            </>
          )}

          {a.status !== "draft" && (
            <div className="panel">
              <h3>Signed copies</h3>
              <AgreementFiles a={a} />
              {a.status === "issued" && (
                <div style={{ marginTop: 14 }}>
                  <AgreementUpload id={a.id} kind="client" label="Upload client-signed copy"
                    help="If the client sent the signed agreement on paper, scan it and upload it here for them." />
                </div>
              )}
              {open && !a.signed_file_name && (
                <div style={{ marginTop: 14 }}>
                  <AgreementUpload id={a.id} kind="signed" label="Upload fully signed copy"
                    help="After Atlas has also signed and stamped it: scan the complete agreement (both signatures and seals)." />
                </div>
              )}
            </div>
          )}

          {open && isAdmin && (
            <div className="internal" style={{ marginTop: 16 }}>
              <b>CONFIRM SIGNED</b>
              {a.signed_file_name ? (
                <ActionForm action={confirmAgreementSigned} submit="Confirm agreement is signed">
                  <input type="hidden" name="id" value={a.id} />
                  <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    Check the fully signed copy first: both signatures, both seals, every page. After confirming, nothing can be changed.
                  </p>
                </ActionForm>
              ) : (
                <p className="muted" style={{ marginTop: 8 }}>Available once the fully signed copy is uploaded.</p>
              )}
              <hr style={{ border: 0, borderTop: "1px solid var(--au1)", margin: "16px 0" }} />
              <ActionForm action={voidAgreement} submit="Cancel this agreement">
                <input type="hidden" name="id" value={a.id} />
                <label htmlFor="reason" className="muted">Reason (the client will see it)</label>
                <textarea id="reason" name="reason" maxLength={2000} />
              </ActionForm>
            </div>
          )}

          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Record</h3>
            <dl className="dl" style={{ gridTemplateColumns: "100px 1fr" }}>
              <dt>Issued</dt><dd>{a.issued_at ? `${fmtDateTime(a.issued_at)} by ${personName(a.issuer)}` : "—"}</dd>
              <dt>Signed</dt><dd>{a.confirmed_at ? `Confirmed ${fmtDateTime(a.confirmed_at)} by ${personName(a.confirmer)}` : "—"}</dd>
              {a.voided_at && (<><dt>Cancelled</dt><dd>{fmtDateTime(a.voided_at)} by {personName(a.voider)}: <span className="challenge">{a.void_reason}</span></dd></>)}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}

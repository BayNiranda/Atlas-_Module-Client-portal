import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { ASSESSMENT_STATUS, assessmentTone, getAssessment } from "@/modules/assessments/queries";
import { reviewAssessment } from "@/modules/assessments/actions";
import { progress, type Definition } from "@/modules/assessments/answers";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";
import { AssessmentAnswers } from "@/components/assessment-answers";
import { PrintButton } from "@/components/print-button";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AssessmentReview({ params }: PageProps<"/admin/assessments/[id]">) {
  await requireStaff();
  const a = await getAssessment((await params).id);
  if (!a?.version) notFound();
  const def = a.version.definition as Definition;
  const p = progress(def, a.answers);

  return (
    <>
      <p className="muted no-print"><Link href="/admin/assessments">← All pre-assessments</Link></p>
      <div className="top">
        <div>
          <h1>{a.organization?.name}</h1>
          <span className={`st ${assessmentTone(a.status)}`}>{ASSESSMENT_STATUS[a.status]}</span>{" "}
          <span className="muted">Version {a.version.version} · {p.answered} of {p.total} answered</span>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          <PrintButton label="Print answers" />
          {a.organization?.source_inquiry_id && (
            <Link className="btn btn-o btn-sm" href={`/admin/inquiries/${a.organization.source_inquiry_id}`}>Open inquiry</Link>
          )}
          {a.status === "approved" && (
            <Link className="btn btn-p btn-sm" href={`/admin/proposals/new?org=${a.organization_id}`}>New proposal</Link>
          )}
        </div>
      </div>

      <div className="cols">
        <AssessmentAnswers def={def} answers={a.answers} />
        <div className="no-print">
          <div className="internal">
            <b>REVIEW</b>
            <dl className="dl" style={{ gridTemplateColumns: "110px 1fr", marginBottom: 8 }}>
              <dt>Submitted</dt><dd>{a.submitted_at ? `${fmtDateTime(a.submitted_at)} by ${personName(a.submitter)}` : "—"}</dd>
              <dt>Reviewed</dt><dd>{a.reviewed_at ? `${fmtDateTime(a.reviewed_at)} by ${personName(a.reviewer)}` : "—"}</dd>
              {a.review_comment && (<><dt>Comment</dt><dd className="challenge">{a.review_comment}</dd></>)}
            </dl>
            {a.status === "submitted" ? (
              <>
                <ActionForm action={reviewAssessment} submit="Approve">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <p className="muted" style={{ margin: 0 }}>Approving locks the answers and allows a proposal to be sent.</p>
                </ActionForm>
                <hr style={{ border: 0, borderTop: "1px solid var(--au1)", margin: "16px 0" }} />
                <ActionForm action={reviewAssessment} submit="Request changes">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="decision" value="changes" />
                  <label htmlFor="comment" className="muted">What should the client change or add? (they will see this)</label>
                  <textarea id="comment" name="comment" maxLength={2000} required />
                </ActionForm>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {a.status === "approved" ? "Approved and locked." : "Waiting for the client to submit."}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

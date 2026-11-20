import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { getProposal, listVersions } from "@/modules/proposals/queries";
import { deleteDraft, reviseProposal, sendProposal, withdrawProposal } from "@/modules/proposals/actions";
import { displayStatus, proposalRef, STATUS_LABEL, statusTone } from "@/modules/proposals/labels";
import { fmtDate, fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";
import { ProposalDocument } from "@/components/proposal-document";
import { PrintButton } from "@/components/print-button";
import { ActionForm } from "@/components/action-form";
import { ASSESSMENT_STATUS, assessmentTone, getOrgAssessment } from "@/modules/assessments/queries";
import { editorChoices } from "../data";
import { ProposalEditor } from "../proposal-editor";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function ProposalPage({ params }: PageProps<"/admin/proposals/[id]">) {
  const user = await requireStaff();
  const p = await getProposal((await params).id);
  if (!p) notFound();
  const status = displayStatus(p);
  const canSend = user.staffRole === "SUPER_ADMIN" || user.staffRole === "ADMIN";
  const [versions, choices, assessment] = await Promise.all([
    listVersions(p.number),
    p.status === "draft" ? editorChoices() : null,
    p.status === "draft" ? getOrgAssessment(p.organization_id) : null,
  ]);

  return (
    <>
      <p className="muted no-print"><Link href="/admin/proposals">← All proposals</Link></p>
      <div className="top">
        <div>
          <h1>{proposalRef(p)} · {p.organization?.name}</h1>
          <span className={`st ${statusTone(status)}`}>{STATUS_LABEL[status]}</span>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          {p.status !== "draft" && <PrintButton />}
          {["sent", "declined", "withdrawn"].includes(p.status) && (
            <ActionForm action={reviseProposal} submit="Revise (new version)" className="inline-status">
              <input type="hidden" name="id" value={p.id} />
            </ActionForm>
          )}
          {p.status === "sent" && canSend && (
            <ActionForm action={withdrawProposal} submit="Withdraw" className="inline-status">
              <input type="hidden" name="id" value={p.id} />
            </ActionForm>
          )}
        </div>
      </div>

      {p.status === "draft" && choices ? (
        <div className="cols">
          <div>
            <ProposalEditor
              id={p.id}
              orgs={choices.orgs}
              services={choices.services}
              initial={{
                organization_id: p.organization_id, title: p.title, currency: p.currency, valid_until: p.valid_until,
                introduction: p.introduction ?? "", exclusions: p.exclusions ?? "", payment_terms: p.payment_terms ?? "", terms: p.terms ?? "",
                items: p.proposal_items.map((i) => ({
                  service_id: i.service_id ?? "", title: i.title, scope: i.scope ?? "", deliverables: i.deliverables ?? "",
                  billing: i.billing, amount: String(i.amount),
                })),
              }}
            />
          </div>
          <div>
            <div className="internal">
              <b>SEND TO CLIENT</b>
              <p style={{ margin: "8px 0" }}>
                Pre-assessment:{" "}
                {assessment ? (
                  <Link href={`/admin/assessments/${assessment.id}`}>
                    <span className={`st ${assessmentTone(assessment.status)}`}>{ASSESSMENT_STATUS[assessment.status]}</span>
                  </Link>
                ) : "—"}
              </p>
              {assessment?.status !== "approved" ? (
                <p className="muted" style={{ margin: 0 }}>Atlas rule: a proposal is sent only after the client&apos;s pre-assessment is approved. You can keep editing this draft meanwhile.</p>
              ) : canSend ? (
                <ActionForm action={sendProposal} submit="Send proposal">
                  <input type="hidden" name="id" value={p.id} />
                  <p className="muted" style={{ margin: 0 }}>Save your latest changes first. Once sent, this version can no longer be changed.</p>
                </ActionForm>
              ) : (
                <p className="muted" style={{ marginTop: 8 }}>Only an Admin or Super admin can send proposals. Save the draft and ask them to review it.</p>
              )}
            </div>
            <div className="panel" style={{ marginTop: 16 }}>
              <h3>Delete draft</h3>
              <ActionForm action={deleteDraft} submit="Delete this draft">
                <input type="hidden" name="id" value={p.id} />
              </ActionForm>
            </div>
          </div>
          <details style={{ gridColumn: "1 / -1" }}>
            <summary className="btn btn-o btn-sm">Preview as the client will see it (last saved version)</summary>
            <div style={{ marginTop: 12 }}><ProposalDocument p={p} /></div>
          </details>
        </div>
      ) : (
        <div className="cols">
          <ProposalDocument p={p} />
          <div className="no-print">
            <div className="panel">
              <h3>Record</h3>
              <dl className="dl" style={{ gridTemplateColumns: "120px 1fr" }}>
                <dt>Sent</dt><dd>{p.sent_at ? `${fmtDateTime(p.sent_at)} by ${personName(p.sender)}` : "—"}</dd>
                <dt>Based on</dt>
                <dd>{p.assessment_id ? <Link href={`/admin/assessments/${p.assessment_id}`}>Approved pre-assessment</Link> : "—"}</dd>
                <dt>Response</dt>
                <dd>{p.responded_at ? `${STATUS_LABEL[p.status]} ${fmtDateTime(p.responded_at)} by ${personName(p.responder)}` : "—"}</dd>
                {p.decline_reason && (<><dt>Reason</dt><dd className="challenge">{p.decline_reason}</dd></>)}
              </dl>
            </div>
            <VersionList versions={versions} currentId={p.id} />
          </div>
        </div>
      )}
    </>
  );
}

function VersionList({ versions, currentId }: { versions: { id: string; version: number; status: string; valid_until: string }[]; currentId: string }) {
  if (versions.length < 2) return null;
  return (
    <div className="panel">
      <h3>Versions</h3>
      <ul className="notes" style={{ marginTop: 0 }}>
        {versions.map((v) => {
          const s = displayStatus(v);
          return (
            <li key={v.id}>
              {v.id === currentId ? <b>v{v.version} (this one)</b> : <Link href={`/admin/proposals/${v.id}`}>v{v.version}</Link>}{" "}
              <span className={`st ${statusTone(s)}`}>{STATUS_LABEL[s]}</span>
              <small style={{ display: "block" }}>Valid until {fmtDate(v.valid_until)}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

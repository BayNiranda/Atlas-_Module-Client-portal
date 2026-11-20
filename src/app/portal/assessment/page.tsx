import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/modules/portal/org";
import { ASSESSMENT_STATUS, assessmentTone, getOrgAssessment } from "@/modules/assessments/queries";
import type { Definition } from "@/modules/assessments/answers";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";
import { AssessmentAnswers } from "@/components/assessment-answers";
import { PrintButton } from "@/components/print-button";
import { QuestionnaireForm } from "./questionnaire-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalAssessment() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");
  const a = await getOrgAssessment(current.orgId);
  if (!a?.version) {
    return <div className="panel" style={{ maxWidth: 640 }}><h1>Pre-assessment</h1><p>Your pre-assessment is not available yet. Atlas will open it for you.</p></div>;
  }
  const def = a.version.definition as Definition;
  const editable = ["not_started", "in_progress", "changes_requested"].includes(a.status);

  // Prefill from the person filling it in and their company (they can change it).
  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single();
  const prefill = { contact_name: me?.full_name ?? "", email: me?.email ?? "", phone: me?.phone ?? "", company_name: current.orgName };

  return (
    <>
      <div className="top">
        <div>
          <h1>Pre-assessment</h1>
          <div className="sub">{current.orgName} · {def.title} (version {a.version.version})</div>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          <span className={`st ${assessmentTone(a.status)}`}>{ASSESSMENT_STATUS[a.status]}</span>
          {!editable && <PrintButton label="Print answers" />}
        </div>
      </div>

      {a.status === "changes_requested" && a.review_comment && (
        <div className="msg err" role="alert" style={{ marginBottom: 16 }}>
          <b>Atlas asked for changes:</b> <span className="challenge">{a.review_comment}</span>
        </div>
      )}

      {editable ? (
        <>
          <div className="panel intro-box no-print" style={{ marginBottom: 16 }}>
            {def.intro.map((p) => <p key={p}>{p}</p>)}
            <p style={{ marginBottom: 4 }}><b>{def.safety_title}</b></p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>{def.safety.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="muted" style={{ margin: 0 }}>{def.required_note} Use <b>Save</b> to keep your answers and finish later.</p>
          </div>
          <QuestionnaireForm assessmentId={a.id} def={def} answers={a.answers} prefill={prefill} />
        </>
      ) : (
        <>
          <div className="panel no-print" style={{ marginBottom: 16 }}>
            {a.status === "submitted" ? def.thank_you.map((p) => <p key={p}>{p}</p>) : (
              <p style={{ margin: 0 }}>Approved by Atlas{a.reviewed_at ? ` on ${fmtDateTime(a.reviewed_at)}` : ""}. Atlas will use it to prepare your proposal.</p>
            )}
            {a.submitted_at && <p className="muted" style={{ margin: 0 }}>Submitted by {personName(a.submitter)} on {fmtDateTime(a.submitted_at)}.</p>}
          </div>
          <AssessmentAnswers def={def} answers={a.answers} />
        </>
      )}
    </>
  );
}

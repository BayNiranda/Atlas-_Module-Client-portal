import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { getMemberships } from "@/modules/portal/org";
import { AGREEMENT_STATUS, agreementRef, agreementTone, getAgreement } from "@/modules/agreements/queries";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { waLink } from "@/lib/site";
import { AgreementDocument } from "@/components/agreement-document";
import { AgreementFiles } from "@/components/agreement-files";
import { AgreementUpload } from "@/components/agreement-upload";
import { PrintButton } from "@/components/print-button";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalAgreement({ params }: PageProps<"/portal/agreements/[id]">) {
  const user = await requireClient();
  // RLS returns nothing for drafts or other companies, so this 404s for them.
  const a = await getAgreement((await params).id);
  if (!a) notFound();
  const isOwner = (await getMemberships(user.id)).some((m) => m.orgId === a.organization_id && m.role === "CLIENT_OWNER");

  return (
    <>
      <p className="muted no-print"><Link href="/portal/agreements">← All agreements</Link></p>
      <div className="top">
        <div>
          <h1>{a.title}</h1>
          <span className={`st ${agreementTone(a.status)}`}>{AGREEMENT_STATUS[a.status]}</span>{" "}
          <span className="muted">{agreementRef(a)}</span>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          <PrintButton label="Print / Save as PDF" />
          <a className="btn btn-wa btn-sm" target="_blank" rel="noopener noreferrer"
             href={waLink(`Hello Atlas Advisory, I have a question about agreement ${agreementRef(a)}.`)}>Ask a question</a>
        </div>
      </div>

      <div className="cols">
        <AgreementDocument a={a} />
        <div className="no-print">
          {a.status === "issued" && (
            <div className="internal">
              <b>HOW TO SIGN</b>
              <ol style={{ margin: "8px 0", paddingLeft: 20, listStyle: "decimal" }}>
                <li>Click <b>Print / Save as PDF</b> and print the agreement.</li>
                <li>An authorised person signs where marked and applies the <b>company seal</b>.</li>
                <li>Scan or photograph every page clearly (PDF preferred).</li>
                <li>{isOwner ? "Upload it below." : "Ask an owner of your company to upload it."}</li>
              </ol>
              {isOwner && (
                <AgreementUpload id={a.id} kind="client" label="Upload signed agreement"
                  help="PDF, JPG or PNG, up to 10 MB. Atlas will then sign and seal it too." />
              )}
            </div>
          )}
          {a.status === "client_signed" && (
            <div className="panel"><p style={{ margin: 0 }}>Thank you. Atlas is countersigning. You will be notified when the fully signed copy is ready.</p></div>
          )}
          {a.status === "signed" && a.confirmed_at && (
            <div className="panel"><p style={{ margin: 0 }}>Signed by both parties. Confirmed on {fmtDateTime(a.confirmed_at)}.</p></div>
          )}
          {a.status === "voided" && (
            <div className="panel"><p style={{ margin: 0 }}>Atlas cancelled this agreement: <span className="challenge">{a.void_reason}</span></p></div>
          )}
          {a.status === "superseded" && <div className="panel"><p style={{ margin: 0 }}>A newer version replaces this agreement. See All agreements.</p></div>}

          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Signed copies</h3>
            <AgreementFiles a={a} />
          </div>
        </div>
      </div>
    </>
  );
}

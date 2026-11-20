import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { getMemberships } from "@/modules/portal/org";
import { getProposal } from "@/modules/proposals/queries";
import { displayStatus, proposalRef, STATUS_LABEL, statusTone } from "@/modules/proposals/labels";
import { fmtDateTime } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";
import { waLink } from "@/lib/site";
import { ProposalDocument } from "@/components/proposal-document";
import { PrintButton } from "@/components/print-button";
import { Decision } from "./decision";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalProposal({ params }: PageProps<"/portal/proposals/[id]">) {
  const user = await requireClient();
  // RLS returns nothing for drafts or other companies, so this 404s for them.
  const p = await getProposal((await params).id);
  if (!p) notFound();
  const membership = (await getMemberships(user.id)).find((m) => m.orgId === p.organization_id);
  const status = displayStatus(p);
  const isOwner = membership?.role === "CLIENT_OWNER";

  return (
    <>
      <p className="muted no-print"><Link href="/portal/proposals">← All proposals</Link></p>
      <div className="top">
        <div>
          <h1>{p.title}</h1>
          <span className={`st ${statusTone(status)}`}>{STATUS_LABEL[status]}</span>{" "}
          <span className="muted">{proposalRef(p)}</span>
        </div>
        <div className="doc-actions" style={{ margin: 0 }}>
          <PrintButton />
          <a className="btn btn-wa btn-sm" target="_blank" rel="noopener noreferrer"
             href={waLink(`Hello Atlas Advisory, I have a question about proposal ${proposalRef(p)} (${p.title}).`)}>
            Ask a question
          </a>
        </div>
      </div>

      <ProposalDocument p={p} />

      <div className="decision no-print">
        {status === "sent" && isOwner && (
          <div className="panel">
            <h3>Your decision</h3>
            <Decision id={p.id} company={p.organization?.name ?? "your company"} />
          </div>
        )}
        {status === "sent" && !isOwner && (
          <p className="muted">An owner of {p.organization?.name} can accept or decline this proposal.</p>
        )}
        {status === "expired" && (
          <p className="muted">This proposal has expired. Ask Atlas for an updated one if you would like to go ahead.</p>
        )}
        {(status === "accepted" || status === "declined") && p.responded_at && (
          <p className="muted">{STATUS_LABEL[status]} by {personName(p.responder)} on {fmtDateTime(p.responded_at)}.</p>
        )}
        {status === "superseded" && <p className="muted">A newer version of this proposal has been sent. See All proposals.</p>}
        {status === "withdrawn" && <p className="muted">Atlas has withdrawn this proposal and will be in touch.</p>}
      </div>
    </>
  );
}

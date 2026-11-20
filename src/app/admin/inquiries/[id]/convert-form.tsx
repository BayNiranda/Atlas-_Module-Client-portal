"use client";

import { useState } from "react";
import { convertAndInvite, newClientSignInLink } from "@/modules/inquiries/admin-actions";
import type { ActionResult } from "@/modules/inquiries/admin-schema";
import { ActionForm } from "@/components/action-form";

type Props = { inquiryId: string; company: string; contact: string; email: string | null };

export function ConvertForm({ inquiryId, company, contact, email }: Props) {
  return (
    <ActionForm
      action={convertAndInvite}
      submit="Create client & invite"
      done={(r) => <LinkResult result={r} doneHref={`/admin/inquiries/${inquiryId}`} heading="Client created." />}
    >
      <input type="hidden" name="inquiry_id" value={inquiryId} />
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="org_name">Organization name</label>
          <input id="org_name" name="org_name" defaultValue={company} required />
        </div>
        <div className="field">
          <label htmlFor="full_name">Client&apos;s name</label>
          <input id="full_name" name="full_name" defaultValue={contact} required />
        </div>
        <div className="field">
          <label htmlFor="invite_email">Client&apos;s email (their login)</label>
          <input id="invite_email" name="email" type="email" defaultValue={email ?? ""} required />
        </div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        This creates the organization, gives this person a client-owner login, and moves the inquiry to Pre-assessment.
        You then send them a one-time link.
      </p>
    </ActionForm>
  );
}

// For a converted inquiry whose invitation link was lost or has expired.
export function NewLinkForm({ inquiryId }: { inquiryId: string }) {
  return (
    <ActionForm
      action={newClientSignInLink}
      submit="Create a new sign-in link"
      done={(r) => <LinkResult result={r} doneHref={`/admin/inquiries/${inquiryId}`} heading="New link created." />}
    >
      <input type="hidden" name="inquiry_id" value={inquiryId} />
      <p className="muted" style={{ margin: 0 }}>
        Use this if the client lost their invitation or it expired. The new link lets them choose a password.
      </p>
    </ActionForm>
  );
}

function LinkResult({ result, doneHref, heading }: { result: ActionResult; doneHref: string; heading: string }) {
  const [copied, setCopied] = useState(false);
  const { link, email, whatsapp, message } = result;
  return (
    <div className="msg ok" role="status">
      {link ? (
        <>
          <b>{heading}</b> Send this private link to <b>{email}</b>. It works once and expires in 24 hours. Only send it to the client themselves.
          <div className="invite-link">
            <input readOnly value={link} aria-label="Sign-in link" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-o btn-sm" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        message
      )}
      <div className="actions">
        {whatsapp && <a className="btn btn-wa btn-sm" href={whatsapp} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>}
        {/* Full reload so the rest of the page shows the new client and stage. */}
        <a className="btn btn-o btn-sm" href={doneHref}>Done</a>
      </div>
    </div>
  );
}

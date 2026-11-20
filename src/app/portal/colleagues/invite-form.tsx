"use client";

import { useState } from "react";
import { inviteColleague } from "@/modules/portal/actions";
import { ActionForm } from "@/components/action-form";

export function InviteColleagueForm({ company }: { company: string }) {
  return (
    <ActionForm action={inviteColleague} submit="Give access" done={(r) => <Result link={r.link} email={r.email} message={r.message} />}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="full_name">Their name</label>
          <input id="full_name" name="full_name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="email">Their email (their login)</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="role">Access</label>
          <select id="role" name="role" defaultValue="CLIENT_MEMBER">
            <option value="CLIENT_MEMBER">Member (view and take part)</option>
            <option value="CLIENT_OWNER">Owner (also accepts proposals, signs, manages access)</option>
          </select>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>They will be able to see everything about {company} in this portal.</p>
    </ActionForm>
  );
}

function Result({ link, email, message }: { link?: string; email?: string; message?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="msg ok" role="status">
      {link ? (
        <>
          <b>Access created.</b> Send this private link to <b>{email}</b> yourself. It works once and expires in 24 hours. Only send it to that person.
          <div className="invite-link">
            <input readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-o btn-sm" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        message
      )}
      <div className="actions"><a className="btn btn-o btn-sm" href="/portal/colleagues">Done</a></div>
    </div>
  );
}

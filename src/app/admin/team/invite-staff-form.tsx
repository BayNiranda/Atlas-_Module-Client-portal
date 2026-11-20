"use client";

import { useState } from "react";
import { inviteStaff } from "@/modules/team/actions";
import { STAFF_ROLES } from "@/modules/inquiries/labels";
import { ActionForm } from "@/components/action-form";

export function InviteStaffForm() {
  return (
    <ActionForm action={inviteStaff} submit="Create login" done={(r) => <StaffLink link={r.link!} email={r.email!} />}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="full_name">Name</label>
          <input id="full_name" name="full_name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="CONSULTANT">
            {STAFF_ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
    </ActionForm>
  );
}

function StaffLink({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="msg ok" role="status">
      <b>Login created for {email}.</b> Send them this private link (works once, expires in 24 hours).
      They choose a password, then set up their authenticator app on first sign-in.
      <div className="invite-link">
        <input readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-o btn-sm" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p style={{ marginTop: 8 }}><a href="/admin/team">Invite someone else</a></p>
    </div>
  );
}

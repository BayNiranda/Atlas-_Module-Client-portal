"use client";

import { switchOrg } from "@/modules/portal/actions";

// Shown only to people who belong to more than one company.
export function OrgSwitcher({ orgs, current }: { orgs: { id: string; name: string }[]; current: string }) {
  return (
    <form action={switchOrg} className="org-switch">
      <label htmlFor="org" className="grp" style={{ display: "block", margin: "0 4px 6px" }}>Company</label>
      <select id="org" name="org" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <noscript><button type="submit">Switch</button></noscript>
    </form>
  );
}

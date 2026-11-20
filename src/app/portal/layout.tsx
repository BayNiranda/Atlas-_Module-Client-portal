import "../shell.css";
import Link from "next/link";
import { requireClient } from "@/lib/auth/guards";
import { getCurrentOrg } from "@/modules/portal/org";
import { unreadNotificationCount } from "@/modules/notifications/queries";
import { ShellNav, type NavItem } from "@/components/shell-nav";
import { listProposals } from "@/modules/proposals/queries";
import { displayStatus } from "@/modules/proposals/labels";
import { getOrgAssessment } from "@/modules/assessments/queries";
import { listAgreements } from "@/modules/agreements/queries";
import { OrgSwitcher } from "./org-switcher";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireClient();
  const [{ current, memberships }, unread] = await Promise.all([getCurrentOrg(user.id), unreadNotificationCount()]);

  const [proposals, assessment, agreements] = current
    ? await Promise.all([listProposals({ orgId: current.orgId }), getOrgAssessment(current.orgId), listAgreements({ orgId: current.orgId })])
    : [[], null, []];
  const openProposals = proposals.filter((p) => displayStatus(p) === "sent").length;
  const toSign = agreements.filter((a) => a.status === "issued").length;
  // Badge while the pre-assessment needs the client's action.
  const assessmentTodo = assessment && ["not_started", "in_progress", "changes_requested"].includes(assessment.status) ? 1 : 0;

  const items: NavItem[] = [
    { href: "/portal", label: "Dashboard", exact: true },
    ...(current ? [{ href: "/portal/assessment", label: "Pre-assessment", count: assessmentTodo }] : []),
    ...(current ? [{ href: "/portal/proposals", label: "Proposals", count: openProposals }] : []),
    ...(current ? [{ href: "/portal/agreements", label: "Agreements", count: toSign }] : []),
    ...(current ? [{ href: "/portal/colleagues", label: "Colleagues" }] : []),
    { href: "/portal/notifications", label: "Notifications", count: unread },
  ];

  return (
    <div className="shell">
      <aside className="side">
        <Link className="brand" href="/portal">
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
          <img src="/brand/mark.webp" alt="" width={42} height={32} />
          <span className="wm"><b>ATLAS</b><em>CLIENT PORTAL</em></span>
        </Link>
        {memberships.length > 1 && current ? (
          <OrgSwitcher orgs={memberships.map((m) => ({ id: m.orgId, name: m.orgName }))} current={current.orgId} />
        ) : (
          current && <div className="org-name">{current.orgName}</div>
        )}
        <ShellNav items={items} label="Client portal" />
        <div className="who">
          <b>{user.fullName ?? user.email}</b>
          {current ? (current.role === "CLIENT_OWNER" ? "Company owner" : "Company member") : "Client"}
          <div><Link href="/account/profile" className="who-link">My profile</Link></div>
          <form action="/auth/signout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

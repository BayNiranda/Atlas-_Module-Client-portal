import "../shell.css";
import Link from "next/link";
import { requireClient } from "@/lib/auth/guards";
import { signOut } from "@/modules/auth/actions";
import { getCurrentOrg } from "@/modules/portal/org";
import { unreadNotificationCount } from "@/modules/notifications/queries";
import { ShellNav, type NavItem } from "@/components/shell-nav";
import { OrgSwitcher } from "./org-switcher";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireClient();
  const [{ current, memberships }, unread] = await Promise.all([getCurrentOrg(user.id), unreadNotificationCount()]);

  const items: NavItem[] = [
    { href: "/portal", label: "Dashboard", exact: true },
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
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

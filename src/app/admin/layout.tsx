import "../shell.css";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/modules/inquiries/labels";
import { unreadNotificationCount } from "@/modules/notifications/queries";
import { ShellNav, type NavItem } from "@/components/shell-nav";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const supabase = await createClient();
  const [{ count: newInquiries }, { count: toReview }, unread] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("assessments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    unreadNotificationCount(),
  ]);

  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/inquiries", label: "Inquiries", count: newInquiries ?? 0 },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/assessments", label: "Pre-assessments", count: toReview ?? 0 },
    { href: "/admin/proposals", label: "Proposals" },
    { href: "/admin/notifications", label: "Notifications", count: unread },
    ...(user.staffRole === "SUPER_ADMIN" ? [{ href: "/admin/team", label: "Team" }] : []),
  ];

  return (
    <div className="shell">
      <aside className="side">
        <Link className="brand" href="/admin">
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
          <img src="/brand/mark.webp" alt="" width={42} height={32} />
          <span className="wm"><b>ATLAS</b><em>ADMIN</em></span>
        </Link>
        <div className="grp">Operations</div>
        <ShellNav items={items} label="Admin" />
        <div className="who">
          <b>{user.fullName ?? user.email}</b>
          {roleLabel(user.staffRole)} · MFA on
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

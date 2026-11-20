import "./admin.css";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/modules/auth/actions";
import { roleLabel } from "@/modules/inquiries/labels";
import { SideNav } from "./_components/side-nav";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const supabase = await createClient();
  const { count } = await supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new");

  return (
    <div className="admin">
      <aside className="side">
        <Link className="brand" href="/admin">
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
          <img src="/brand/mark.webp" alt="" width={42} height={32} />
          <span className="wm"><b>ATLAS</b><em>ADMIN</em></span>
        </Link>
        <div className="grp">Operations</div>
        <SideNav newCount={count ?? 0} showTeam={user.staffRole === "SUPER_ADMIN"} />
        <div className="who">
          <b>{user.fullName ?? user.email}</b>
          {roleLabel(user.staffRole)} · MFA on
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

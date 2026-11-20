import { requireStaff } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  return (
    <>
      <AppHeader area="Admin" name={user.fullName ?? user.email ?? "Staff"} role={user.staffRole} />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
    </>
  );
}

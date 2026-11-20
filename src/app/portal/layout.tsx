import { requireClient } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireClient();
  return (
    <>
      <AppHeader area="Client portal" name={user.fullName ?? user.email ?? "Client"} role="Client" />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
    </>
  );
}

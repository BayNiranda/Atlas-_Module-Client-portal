import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth/guards";
import { LoginForm } from "./login-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-neutral-500">Atlas Advisory client portal and staff area.</p>
      <LoginForm />
    </main>
  );
}

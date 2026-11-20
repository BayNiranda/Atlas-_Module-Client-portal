import { requireUser } from "@/lib/auth/guards";
import { PasswordForm } from "./password-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function SetPasswordPage() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Choose a password</h1>
      <PasswordForm />
    </main>
  );
}

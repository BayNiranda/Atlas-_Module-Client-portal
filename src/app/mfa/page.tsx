import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { MfaForm } from "./mfa-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

// Staff must pass an authenticator-app code before reaching /admin.
export default async function MfaPage() {
  const user = await requireUser();
  if (!user.staffRole) redirect("/portal");
  if (user.mfaPassed) redirect("/admin");

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Two-step verification</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Staff accounts need a code from an authenticator app (Google Authenticator, Microsoft
        Authenticator, 1Password…).
      </p>
      <MfaForm />
    </main>
  );
}

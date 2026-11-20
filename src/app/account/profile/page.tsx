import "../../shell.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { changePassword, updateProfile } from "@/modules/auth/actions";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function ProfilePage() {
  const user = await requireUser();
  // Staff must pass the authenticator code before changing anything.
  if (user.staffRole && !user.mfaPassed) redirect("/mfa");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).single();

  return (
    <div className="shell" style={{ display: "block" }}>
      <main className="main" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="muted"><Link href={homeFor(user)}>← Back</Link></p>
        <div className="top"><div><h1>My profile</h1><div className="sub">{profile?.email}</div></div></div>

        <div className="panel">
          <h3>Your details</h3>
          <ActionForm action={updateProfile} submit="Save">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="full_name">Full name</label>
                <input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone / WhatsApp <span className="opt">(optional)</span></label>
                <input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} maxLength={40} autoComplete="tel" />
              </div>
            </div>
          </ActionForm>
        </div>

        <div className="panel">
          <h3>Change password</h3>
          <ActionForm action={changePassword} submit="Change password">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="password">New password (12+ characters)</label>
                <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
              </div>
            </div>
          </ActionForm>
        </div>
      </main>
    </div>
  );
}

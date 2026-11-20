import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates a login for a new person and returns a one-time link they open to choose
// a password. Approved service-key use: "sending invitations" (DESIGN.md 6.3).
// The link expires after 24 hours (auth.email.otp_expiry) and works only once.
export async function createInvitation(email: string, fullName: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("Missing environment variable NEXT_PUBLIC_SITE_URL.");
  const link = `${site}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=invite`;
  return { userId: data.user.id, link };
}

// A fresh one-time link for an existing login (lost or expired invitation).
// Opens the "choose a password" page, same as an invitation.
export async function createSignInLink(email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("Missing environment variable NEXT_PUBLIC_SITE_URL.");
  return `${site}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
}

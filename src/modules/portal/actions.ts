"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createInvitation } from "@/lib/auth/invite";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, firstError } from "@/modules/inquiries/admin-schema";
import { getCurrentOrg, getMemberships, ORG_COOKIE } from "./org";

// Switch the portal to another of the person's own companies.
export async function switchOrg(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const orgId = String(fd.get("org") ?? "");
  const allowed = (await getMemberships(user.id)).some((m) => m.orgId === orgId);
  if (allowed) {
    (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/portal" });
  }
  redirect("/portal");
}

const ERRORS: Record<string, string> = {
  not_allowed: "Only an owner of this company can do that.",
  user_is_staff: "That email belongs to an Atlas staff account.",
  cannot_remove_self: "You cannot remove yourself.",
  last_owner: "A company must always have at least one owner.",
  member_not_found: "That person no longer has access.",
};
const explain = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? "Could not save. Please try again.";

const inviteSchema = z.object({
  full_name: z.string().trim().min(1, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
  role: z.enum(["CLIENT_MEMBER", "CLIENT_OWNER"]),
});

// An owner adds a colleague to the company currently shown in the portal.
export async function inviteColleague(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.staffRole) return { error: "Not allowed." };
  const { current } = await getCurrentOrg(user.id);
  if (current?.role !== "CLIENT_OWNER") return { error: ERRORS.not_allowed };
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  // Does this person already have a login? Owners cannot look up strangers'
  // profiles (RLS), so the check uses the invitation step itself.
  const supabase = await createClient();
  let userId: string | undefined;
  let link: string | undefined;
  try {
    ({ userId, link } = await createInvitation(d.email, d.full_name));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== "email_exists") {
      console.error("createInvitation failed", e);
      return { error: "Could not create the login. Please try again." };
    }
    // Existing login: add them by id, looked up with the server key (approved invitation use).
    const { data } = await createAdminClient().from("profiles").select("id").eq("email", d.email).maybeSingle();
    userId = data?.id;
    if (!userId) return { error: "Could not find that login. Please contact Atlas." };
  }

  const { error } = await supabase.rpc("add_org_member", { p_org: current.orgId, p_user: userId, p_role: d.role });
  if (error) return { error: explain(error.message) };
  refresh();
  // Neutral wording: an owner should not learn whether someone uses the portal for another company.
  if (!link) return { ok: true, message: `${d.email} now has access to ${current.orgName}. They can sign in with their existing password.` };
  return { ok: true, email: d.email, link };
}

export async function removeColleague(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.staffRole) return { error: "Not allowed." };
  const { current } = await getCurrentOrg(user.id);
  if (current?.role !== "CLIENT_OWNER") return { error: ERRORS.not_allowed };
  const target = z.uuid().safeParse(fd.get("user_id"));
  if (!target.success) return { error: ERRORS.member_not_found };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_org_member", { p_org: current.orgId, p_user: target.data });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Access removed." };
}

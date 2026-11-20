"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createInvitation } from "@/lib/auth/invite";
import { type ActionResult, firstError } from "@/modules/inquiries/admin-schema";

const ROLES = ["SUPER_ADMIN", "ADMIN", "PROJECT_COORDINATOR", "CONSULTANT"] as const;
const NOT_ALLOWED: ActionResult = { error: "Only a Super admin can manage the team." };

const ERRORS: Record<string, string> = {
  cannot_change_self: "You cannot change your own role or deactivate yourself.",
  last_super_admin: "There must always be at least one active Super admin.",
  user_is_client: "That person is a client user and cannot be made staff.",
  user_not_found: "That person was not found.",
};
const explain = (message: string) => Object.entries(ERRORS).find(([k]) => message.includes(k))?.[1] ?? "Could not save. Please try again.";

const inviteSchema = z.object({
  full_name: z.string().trim().min(1, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
  role: z.enum(ROLES),
});

// Invite a new staff member. The role is set through set_staff_access(), which
// the database only allows for a Super admin and which is logged.
export async function inviteStaff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(["SUPER_ADMIN"]))) return NOT_ALLOWED;
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", d.email).maybeSingle();
  if (existing) return { error: "That email already has a login. Change their role in the list below instead." };

  let invite;
  try {
    invite = await createInvitation(d.email, d.full_name);
  } catch (e) {
    console.error("createInvitation failed", e);
    return { error: "Could not create the login. Please try again." };
  }
  const { error } = await supabase.rpc("set_staff_access", { p_user_id: invite.userId, p_role: d.role, p_active: true });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, email: d.email, link: invite.link };
}

const accessSchema = z.object({
  user_id: z.uuid(),
  role: z.union([z.enum(ROLES), z.literal("none")]),
  active: z.enum(["true", "false"]),
});

export async function setStaffAccess(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(["SUPER_ADMIN"]))) return NOT_ALLOWED;
  const parsed = accessSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { user_id, role, active } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_access", {
    p_user_id: user_id, p_role: role === "none" ? null : role, p_active: active === "true",
  });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Saved. The change is in the activity log." };
}

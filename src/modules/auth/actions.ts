"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, homeFor } from "@/lib/auth/guards";
import { loginSchema, newPasswordSchema, type FormState } from "./schema";
import type { ActionResult } from "@/modules/inquiries/admin-schema";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for wrong email and wrong password, so attackers cannot probe accounts.
  if (error) return { error: "Email or password is incorrect." };

  const user = await getCurrentUser();
  if (!user) {
    await supabase.auth.signOut();
    return { error: "This account is not active. Contact Atlas Advisory." };
  }
  redirect(homeFor(user));
}

// Sign-out is a route handler (app/auth/signout) so it reloads the whole page.

// Used after an invitation or password-reset link (see app/auth/confirm).
export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  const user = await getCurrentUser();
  redirect(user ? homeFor(user) : "/login");
}

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(120),
  phone: z.string().trim().max(40),
});

// Name and phone only: the database lets people edit nothing else on their profile.
export async function updateProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return { error: "Could not save. Please try again." };
  refresh();
  return { ok: true, message: "Saved." };
}

// Change password while signed in (staff must have passed MFA to reach the page).
export async function changePassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  return { ok: true, message: "Password changed." };
}

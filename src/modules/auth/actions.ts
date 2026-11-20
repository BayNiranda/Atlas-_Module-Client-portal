"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, homeFor } from "@/lib/auth/guards";
import { loginSchema, newPasswordSchema, type FormState } from "./schema";

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

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

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "SUPER_ADMIN" | "ADMIN" | "PROJECT_COORDINATOR" | "CONSULTANT";

// One lookup per request, however many times a page or layout asks.
export const getCurrentUser = cache(async () => {
  // Who is logged in is only known per request: never prerender past this point.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  // Roles come from the database, never from anything the user can edit.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, staff_role, is_active")
    .eq("id", claims.sub)
    .single();
  if (!profile?.is_active) return null;

  return {
    id: claims.sub,
    email: claims.email as string | undefined,
    fullName: profile.full_name as string | null,
    staffRole: profile.staff_role as StaffRole | null,
    mfaPassed: claims.aal === "aal2",
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Staff pages: must be staff AND have passed the authenticator-app code.
export async function requireStaff(allowed?: StaffRole[]) {
  const user = await requireUser();
  if (!user.staffRole) redirect("/portal");
  if (!user.mfaPassed) redirect("/mfa");
  if (allowed && !allowed.includes(user.staffRole)) redirect("/admin");
  return user as typeof user & { staffRole: StaffRole };
}

// Roles that manage leads and clients (the permission matrix's "coordinator and above").
export const MANAGERS: StaffRole[] = ["SUPER_ADMIN", "ADMIN", "PROJECT_COORDINATOR"];

// For server actions: returns the staff user, or null if not allowed (no redirect).
export async function staffForAction(allowed?: StaffRole[]) {
  const user = await getCurrentUser();
  if (!user?.staffRole || !user.mfaPassed) return null;
  if (allowed && !allowed.includes(user.staffRole)) return null;
  return user as typeof user & { staffRole: StaffRole };
}

// Client pages: staff are sent to the admin area.
export async function requireClient() {
  const user = await requireUser();
  if (user.staffRole) redirect("/admin");
  return user;
}

// Where to send someone right after login.
export function homeFor(user: { staffRole: StaffRole | null; mfaPassed: boolean }) {
  if (!user.staffRole) return "/portal";
  return user.mfaPassed ? "/admin" : "/mfa";
}

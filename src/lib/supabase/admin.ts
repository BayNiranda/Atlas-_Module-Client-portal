import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// DANGER: bypasses every RLS rule. Allowed uses only (DESIGN.md 6.3, as amended):
// saving a public inquiry, sending invitations / sign-in links, and storing or
// serving private agreement files after the app and database permission checks
// (replaces the e-sign webhook: the owner chose signed scans, Module 6).
// "server-only" makes the build fail if browser code imports this file.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

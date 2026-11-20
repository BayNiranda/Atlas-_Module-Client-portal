import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// DANGER: bypasses every RLS rule. Allowed uses only (DESIGN.md 6.3):
// saving a public inquiry, the e-sign webhook, sending invitations.
// "server-only" makes the build fail if browser code imports this file.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

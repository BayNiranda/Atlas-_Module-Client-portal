import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Used in browser components. Only ever holds the public key; RLS protects the data.
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}

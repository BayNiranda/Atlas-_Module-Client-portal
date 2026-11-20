import "server-only";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type Service = {
  slug: string;
  code: string;
  name: string;
  name_lo: string | null;
  summary: string;
  includes: string[];
  audience: string | null;
  deliverables: string[];
  assessment_name: string | null;
};

// Public catalogue. Read with the public key (no login), so RLS only returns
// published, active services. Cached because it rarely changes.
export async function getPublicServices(): Promise<Service[]> {
  "use cache";
  cacheLife("hours");
  const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from("services")
    .select("slug, code, name, name_lo, summary, includes, audience, deliverables, assessment_name")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getPublicService(slug: string) {
  return (await getPublicServices()).find((s) => s.slug === slug) ?? null;
}

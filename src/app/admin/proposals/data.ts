import "server-only";
import { createClient } from "@/lib/supabase/server";

// Choices for the proposal editor (staff session, RLS applies).
export async function editorChoices() {
  const supabase = await createClient();
  const [orgs, services] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("services").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  if (orgs.error) throw orgs.error;
  if (services.error) throw services.error;
  return { orgs: orgs.data, services: services.data };
}

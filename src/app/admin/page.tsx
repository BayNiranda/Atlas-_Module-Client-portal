import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AdminHome() {
  // Pages check again: layouts are not re-run on every navigation.
  await requireStaff();
  const supabase = await createClient();
  const { count } = await supabase.from("organizations").select("id", { count: "exact", head: true });

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Admin</h1>
      <p className="text-sm text-neutral-600">Client organizations: {count ?? 0}</p>
      <p className="mt-6 text-sm text-neutral-500">
        Inquiries, organizations and projects arrive in the next modules.
      </p>
    </>
  );
}

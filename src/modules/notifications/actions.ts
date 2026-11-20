"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

// Mark one notification (or all) as read. RLS limits this to your own.
export async function markNotificationsRead(fd: FormData) {
  if (!(await getCurrentUser())) return;
  const id = z.uuid().safeParse(fd.get("id"));
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (id.success) q = q.eq("id", id.data);
  await q;
  refresh();
}

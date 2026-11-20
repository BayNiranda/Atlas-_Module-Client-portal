import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Download a document. Permission is checked by reading it through the
// person's own session (RLS hides internal files from clients); the download
// is logged; then a link valid for 60 seconds is issued.
export async function GET(request: NextRequest, { params }: RouteContext<"/documents/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (user.staffRole && !user.mfaPassed) return NextResponse.redirect(new URL("/mfa", request.url));

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });

  const logged = await supabase.rpc("log_file_download", { p_entity: "documents", p_id: id });
  if (logged.error) return new NextResponse("Not found", { status: 404 });

  const { data: link, error } = await createAdminClient().storage.from("documents")
    .createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (error || !link) return new NextResponse("Could not create a download link", { status: 500 });
  return NextResponse.redirect(link.signedUrl, 303);
}

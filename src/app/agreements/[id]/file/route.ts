import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Download a stored agreement scan. Permission is checked by reading the
// agreement through the person's own session (RLS); only then is a link
// created, valid for 60 seconds.
export async function GET(request: NextRequest, { params }: RouteContext<"/agreements/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (user.staffRole && !user.mfaPassed) return NextResponse.redirect(new URL("/mfa", request.url));

  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("kind");
  if (!/^[0-9a-f-]{36}$/.test(id) || (kind !== "client" && kind !== "signed")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase.from("agreements").select("client_file_path, signed_file_path").eq("id", id).maybeSingle();
  const path = kind === "client" ? data?.client_file_path : data?.signed_file_path;
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: link, error } = await createAdminClient().storage.from("agreements").createSignedUrl(path, 60, { download: true });
  if (error || !link) return new NextResponse("Could not create a download link", { status: 500 });
  return NextResponse.redirect(link.signedUrl, 303);
}

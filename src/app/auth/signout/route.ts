import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sign out as a plain form POST answered with a redirect, so the browser does a
// full page load. A client-side navigation would keep the previous user's pages
// in memory (Next.js keeps recent pages hidden for instant Back), which could
// expose them to the next person on a shared computer.
export async function POST(request: NextRequest) {
  // Only accept sign-out requests from this site's own pages.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

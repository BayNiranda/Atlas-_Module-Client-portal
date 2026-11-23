import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { siteLockAllows } from "@/lib/site-lock";

const PROTECTED = ["/admin", "/portal", "/mfa", "/account"];

// Runs before every page request: keeps the login session fresh and sends
// logged-out visitors away from private areas. This is only a first, quick
// check; the real permission checks are in src/lib/auth/guards.ts and RLS.
export async function proxy(request: NextRequest) {
  if (!siteLockAllows(request.headers.get("authorization"), process.env.SITE_PASSWORD)) {
    return new NextResponse("This website is private for now.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Atlas Advisory (private)", charset="UTF-8"' },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() verifies the login token; never trust an unverified session here.
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;

  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

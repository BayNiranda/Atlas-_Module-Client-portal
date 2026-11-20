import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email"];

// Invitation and password-reset emails link here. The Supabase email templates must use:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite   (or type=recovery)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const fail = new URL("/login", request.url);
  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return NextResponse.redirect(fail);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(fail);

  // New and recovering users choose a password next. Destination is fixed, never taken
  // from the link, so the link cannot send people to another website.
  const next = type === "email" ? "/login" : "/account/password";
  return NextResponse.redirect(new URL(next, request.url));
}

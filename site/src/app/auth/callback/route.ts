import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthOrigin } from "@/lib/auth-policy";
import { signInEnabled } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  const origin = getAuthOrigin(request.nextUrl.origin);
  if (!await signInEnabled()) {
    const response = NextResponse.redirect(`${origin}/`);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const params = request.nextUrl.searchParams;
  let errorCode = params.get("error") === "access_denied" ? "cancelled" : "callback";
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const emailLink = tokenHash && params.get("type") === "email" && params.getAll("token_hash").length === 1 && params.getAll("type").length === 1;
  if (params.get("error_code") === "otp_expired" || params.has("token_hash")) errorCode = "link";
  if (!params.has("error") && ((code && !tokenHash) || (emailLink && !code))) {
    const supabase = await createClient();
    if (supabase) {
      try {
        const { error } = emailLink
          ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
          : await supabase.auth.exchangeCodeForSession(code!);
        if (!error) {
          const response = NextResponse.redirect(`${origin}/account`);
          response.headers.set("Cache-Control", "private, no-store");
          response.headers.set("Referrer-Policy", "no-referrer");
          return response;
        }
      } catch { /* Only our own error codes reach the page. */ }
    } else errorCode = "provider";
  }
  const response = NextResponse.redirect(`${origin}/sign-in?error=${errorCode}`);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

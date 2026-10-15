import { type NextRequest, NextResponse } from "next/server";
import { signedInClient } from "@/lib/supabase/server";
import { signInEnabled } from "@/lib/feature-flags";
import { canSignIn, getAuthOrigin } from "@/lib/auth-policy";
import {
  getStripeConfig,
  readStripeAccountId,
  createStripeOnboardingLink,
} from "@/lib/stripe-connect-server";

export async function GET(request: NextRequest) {
  const origin = getAuthOrigin(request.nextUrl.origin);
  const back = (path: string) =>
    NextResponse.redirect(new URL(path, origin), {
      headers: { "Cache-Control": "private, no-store" },
    });
  const signedIn = await signedInClient();
  if (!signedIn) return back("/sign-in?error=session");
  if (!canSignIn(signedIn.user.email, await signInEnabled()))
    return back("/sign-in?error=invite_only");
  const config = getStripeConfig();
  if (!config) return back("/account?stripe=unavailable");
  try {
    const accountId = await readStripeAccountId(
      signedIn.supabase,
      signedIn.user.id,
      config.environment,
    );
    if (!accountId) return back("/account");
    return back(await createStripeOnboardingLink(config.stripe, accountId, origin));
  } catch {
    return back("/account?stripe=unavailable");
  }
}

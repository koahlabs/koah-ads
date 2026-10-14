import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signInEnabled } from "@/lib/feature-flags";
import { getAuthOrigin } from "@/lib/auth-policy";
import { getStripeConfig, readStripeAccountId, createStripeOnboardingLink } from "@/lib/stripe-connect-server";

export async function GET(request: NextRequest) {
  const origin = getAuthOrigin(request.nextUrl.origin);
  const back = (path: string) => NextResponse.redirect(new URL(path, origin), { headers: { "Cache-Control": "private, no-store" } });
  if (!await signInEnabled()) return back("/");
  const supabase = await createClient();
  if (!supabase) return back("/sign-in");
  const result = await supabase.auth.getUser().catch(() => null);
  if (!result || result.error || !result.data.user) return back("/sign-in?error=session");
  const config = getStripeConfig();
  if (!config) return back("/account?stripe=unavailable");
  try {
    const accountId = await readStripeAccountId(supabase, result.data.user.id, config.environment);
    if (!accountId) return back("/account");
    const url = await createStripeOnboardingLink(config.stripe, accountId, origin);
    const destination = new URL(url);
    if (destination.protocol !== "https:" || !["accounts.stripe.com", "connect.stripe.com"].includes(destination.hostname)) throw new Error("Invalid Stripe destination");
    return back(url);
  } catch {
    return back("/account?stripe=unavailable");
  }
}

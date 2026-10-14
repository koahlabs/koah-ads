"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInEnabled } from "@/lib/feature-flags";
import { getAuthOrigin } from "@/lib/auth-policy";
import { getDashboard } from "@/lib/dashboard-server";
import { connectPayoutAccount, type ConnectionState } from "@/lib/payout-connection";
import { getStripeConfig, readStripeAccountId, provisionStripeAccount, readStripeStatus, createStripeOnboardingLink } from "@/lib/stripe-connect-server";

export async function connectStripe(_previous: ConnectionState, formData: FormData): Promise<ConnectionState> {
  if (!await signInEnabled()) return { error: "Sign-in is not available right now." };
  const supabase = await createClient();
  if (!supabase) return { error: "Please sign in again." };
  const session = await supabase.auth.getUser().catch(() => null);
  if (!session || session.error || !session.data.user) return { error: "Your session has ended. Please sign in again." };
  const config = getStripeConfig();
  if (!config) return { error: "Stripe setup is unavailable right now. Try again later." };
  const userId = session.data.user.id;
  const requestHeaders = await headers();
  const origin = getAuthOrigin(requestHeaders.get("origin") || undefined);
  const result = await connectPayoutAccount(formData.get("country"), config.countries, {
    readDashboard: () => getDashboard(supabase),
    readAccountId: () => readStripeAccountId(supabase, userId, config.environment),
    createAccount: country => provisionStripeAccount(config, userId, country),
    readStatus: accountId => readStripeStatus(config.stripe, accountId),
    onboardingLink: accountId => createStripeOnboardingLink(config.stripe, accountId, origin),
    dashboardLink: async accountId => (await config.stripe.accounts.createLoginLink(accountId)).url,
  });
  if (result.url) redirect(result.url);
  return { error: result.error };
}

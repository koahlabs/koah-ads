"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowedClient } from "@/lib/supabase/server";
import { authMessages, getAuthOrigin } from "@/lib/auth-policy";
import { canConnectStripe } from "@/lib/dashboard";
import { getDashboard, getSetupStatus } from "@/lib/dashboard-server";
import {
  createStripeLoginLink,
  createStripeOnboardingLink,
  getStripeConfig,
  provisionStripeAccount,
  readStripeAccountId,
  readStripeStatus,
} from "@/lib/stripe-connect-server";

type ConnectionState = { error: string };

// No balance, user ID, or Stripe account ID comes from the browser.
export async function connectStripe(
  _previous: ConnectionState,
  formData: FormData,
): Promise<ConnectionState> {
  const signedIn = await allowedClient();
  if (typeof signedIn === "string") return { error: authMessages[signedIn] };
  const config = getStripeConfig();
  if (!config) return { error: "Stripe setup is unavailable right now. Try again later." };
  const { supabase, user } = signedIn;
  const origin = getAuthOrigin((await headers()).get("origin") || undefined);
  let url: string;
  try {
    const accountId = await readStripeAccountId(supabase, user.id, config.environment);
    if (accountId) {
      url =
        (await readStripeStatus(config.stripe, accountId)) === "connected"
          ? await createStripeLoginLink(config.stripe, accountId)
          : await createStripeOnboardingLink(config.stripe, accountId, origin);
    } else {
      const dashboard = await getDashboard(supabase, user);
      if (!dashboard.available)
        return { error: "We could not verify your balance. Refresh the page and try again." };
      if (!canConnectStripe(dashboard.balanceCents))
        return { error: "Stripe setup unlocks when your available balance exceeds $10.00." };
      const country = formData.get("country");
      if (typeof country !== "string" || !config.countries.includes(country))
        return { error: "Select your country of residence." };
      const newAccountId = await provisionStripeAccount(config, user.id, country);
      url = await createStripeOnboardingLink(config.stripe, newAccountId, origin);
    }
  } catch {
    return { error: "We could not connect to Stripe. Your balance has not changed. Try again." };
  }
  redirect(url);
}

export async function readSetupStatus() {
  const signedIn = await allowedClient();
  if (typeof signedIn === "string") return null;
  return getSetupStatus(signedIn.supabase);
}

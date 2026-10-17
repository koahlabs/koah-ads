import "server-only";
import { Stripe } from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { StripeStatus } from "@/lib/dashboard";

type StripeConfig = { stripe: Stripe; environment: "live" | "test"; countries: string[] };

const stripeHosts = new Set(["connect.stripe.com", "accounts.stripe.com"]);
const idempotencyWindowMs = 23 * 60 * 60 * 1_000;
let stripeConfig: StripeConfig | null | undefined;

function readStripeConfig(): StripeConfig | null {
  const key = process.env.STRIPE_CONNECT_KEY;
  const countries = [
    ...new Set(
      (process.env.STRIPE_CONNECT_COUNTRIES || "")
        .split(",")
        .map((country) => country.trim().toUpperCase())
        .filter((country) => /^[A-Z]{2}$/.test(country)),
    ),
  ];
  if (!key || !/^(rk|sk)_(test|live)_/.test(key) || !countries.length) return null;
  const environment = /^(sk|rk)_live_/.test(key) ? "live" : "test";
  // A production website must not offer a connection to a sandbox account.
  if (process.env.VERCEL_ENV === "production" && environment !== "live") return null;
  // SDK 23 uses the current 2026-09-30.endive API by default.
  return {
    stripe: new Stripe(key, { maxNetworkRetries: 0, timeout: 3_000 }),
    environment,
    countries,
  };
}

export function getStripeConfig() {
  if (stripeConfig === undefined) stripeConfig = readStripeConfig();
  return stripeConfig;
}

function assertStripeUrl(url: string) {
  const destination = new URL(url);
  if (destination.protocol !== "https:" || !stripeHosts.has(destination.hostname))
    throw new Error("Invalid Stripe destination");
  return url;
}

export async function readStripeAccountId(
  supabase: SupabaseClient,
  userId: string,
  environment: string,
) {
  const { data, error } = await supabase
    .from("sidequest_stripe_accounts")
    .select("account_id")
    .eq("user_id", userId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new Error("Stripe connection storage unavailable");
  return typeof data?.account_id === "string" ? data.account_id : null;
}

export async function readStripeStatus(stripe: Stripe, accountId: string): Promise<StripeStatus> {
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient"],
  });
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  return balance?.stripe_transfers?.status === "active" && balance?.payouts?.status === "active"
    ? "connected"
    : "incomplete";
}

export async function getStripeStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<StripeStatus> {
  const config = getStripeConfig();
  if (!config) return "unavailable";
  try {
    const accountId = await readStripeAccountId(supabase, userId, config.environment);
    return accountId ? await readStripeStatus(config.stripe, accountId) : "not_connected";
  } catch {
    return "unavailable";
  }
}

export async function provisionStripeAccount(
  config: StripeConfig,
  userId: string,
  country: string,
) {
  const admin = adminClient();
  // Reserve an immutable request key before calling Stripe. Concurrent submits
  // and retries after a failed save reuse the same account creation request.
  const reservation = await admin
    .from("sidequest_stripe_accounts")
    .upsert(
      { user_id: userId, environment: config.environment, country },
      { onConflict: "user_id,environment", ignoreDuplicates: true },
    );
  if (reservation.error) throw new Error("Could not reserve connection");
  const { data, error } = await admin
    .from("sidequest_stripe_accounts")
    .select("account_id, country, provisioning_key, created_at")
    .eq("user_id", userId)
    .eq("environment", config.environment)
    .single();
  if (error || !data) throw new Error("Could not read connection reservation");
  if (data.account_id) return data.account_id as string;
  let provisioningKey = data.provisioning_key as string;
  // Stripe may expire idempotency keys after 24 hours, and a new country needs a new account.
  // Replace the key of an unfinished reservation instead of waiting on the old request.
  if (data.country !== country || Date.now() - Date.parse(data.created_at) > idempotencyWindowMs) {
    provisioningKey = crypto.randomUUID();
    const renewed = await admin
      .from("sidequest_stripe_accounts")
      .update({ country, provisioning_key: provisioningKey, created_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("environment", config.environment)
      .is("account_id", null)
      .select("user_id");
    if (renewed.error || !renewed.data.length) throw new Error("Could not renew connection");
  }
  const account = await config.stripe.v2.core.accounts.create(
    {
      dashboard: "express",
      identity: { country },
      defaults: {
        currency: "usd",
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      metadata: { sidequest_user_id: userId },
    },
    { idempotencyKey: `sidequest-connect-${provisioningKey}` },
  );
  const saved = await admin
    .from("sidequest_stripe_accounts")
    .update({ account_id: account.id })
    .eq("user_id", userId)
    .eq("environment", config.environment);
  if (saved.error) throw new Error("Could not save connection");
  return account.id;
}

export async function createStripeOnboardingLink(
  stripe: Stripe,
  accountId: string,
  origin: string,
) {
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        return_url: `${origin}/account?stripe=returned`,
        refresh_url: `${origin}/account/stripe/refresh`,
      },
    },
  });
  return assertStripeUrl(link.url);
}

export async function createStripeLoginLink(stripe: Stripe, accountId: string) {
  return assertStripeUrl((await stripe.accounts.createLoginLink(accountId)).url);
}

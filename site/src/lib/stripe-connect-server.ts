import "server-only";
import Stripe from "stripe";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { StripeStatus } from "@/lib/dashboard";

export function getStripeConfig() {
  const key = process.env.STRIPE_CONNECT_KEY;
  const environment = process.env.STRIPE_CONNECT_ENVIRONMENT;
  const adminKey = process.env.SUPABASE_SECRET_KEY;
  const countries = [...new Set((process.env.STRIPE_CONNECT_COUNTRIES || "").split(",").map(country => country.trim().toUpperCase()).filter(country => /^[A-Z]{2}$/.test(country)))];
  if (!key || !/^(rk|sk)_(test|live)_/.test(key) || !environment || !/^[a-zA-Z0-9_-]{1,64}$/.test(environment) || !adminKey?.startsWith("sb_secret_") || !countries.length) return null;
  // A production website must not offer a connection to a sandbox account.
  if (process.env.VERCEL_ENV === "production" && !/^(rk|sk)_live_/.test(key)) return null;
  // SDK 23 uses the current 2026-09-30.endive API by default.
  return { stripe: new Stripe(key, { maxNetworkRetries: 2, timeout: 10_000 }), environment, adminKey, countries };
}

export async function readStripeAccountId(supabase: SupabaseClient, userId: string, environment: string) {
  const { data, error } = await supabase.from("sidequest_stripe_accounts").select("account_id").eq("user_id", userId).eq("environment", environment).maybeSingle();
  if (error) throw new Error("Stripe connection storage unavailable");
  return typeof data?.account_id === "string" ? data.account_id : null;
}

export async function readStripeStatus(stripe: Stripe, accountId: string): Promise<StripeStatus> {
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  return balance?.stripe_transfers?.status === "active" && balance?.payouts?.status === "active" ? "connected" : "incomplete";
}

export async function getStripeStatus(supabase: SupabaseClient, userId: string): Promise<StripeStatus> {
  const config = getStripeConfig();
  if (!config) return "unavailable";
  try {
    const accountId = await readStripeAccountId(supabase, userId, config.environment);
    return accountId ? await readStripeStatus(config.stripe, accountId) : "not_connected";
  } catch {
    return "unavailable";
  }
}

export async function provisionStripeAccount(config: NonNullable<ReturnType<typeof getStripeConfig>>, userId: string, country: string) {
  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) throw new Error("Connection storage unavailable");
  const admin = createSupabaseClient(supabaseConfig.url, config.adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Reserve an immutable request key before calling Stripe. Concurrent submits
  // and retries after a failed save reuse the same account creation request.
  const reservation = await admin.from("sidequest_stripe_accounts").upsert({ user_id: userId, environment: config.environment, country }, { onConflict: "user_id,environment", ignoreDuplicates: true });
  if (reservation.error) throw new Error("Could not reserve connection");
  const { data, error } = await admin.from("sidequest_stripe_accounts").select("account_id, country, provisioning_key, created_at").eq("user_id", userId).eq("environment", config.environment).single();
  if (error || !data) throw new Error("Could not read connection reservation");
  if (data.account_id) return data.account_id as string;
  if (data.country !== country) throw new Error("The country differs from the connection reservation");
  // Stripe may expire idempotency keys after 24 hours. Reconcile an older
  // unfinished reservation manually instead of risking a second account.
  if (Date.now() - Date.parse(data.created_at) > 23 * 60 * 60 * 1_000) throw new Error("Connection reservation needs reconciliation");
  const account = await config.stripe.v2.core.accounts.create({
    dashboard: "express",
    identity: { country: data.country },
    defaults: { currency: "usd", responsibilities: { fees_collector: "application", losses_collector: "application" } },
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    metadata: { sidequest_user_id: userId },
  }, { idempotencyKey: `sidequest-connect-${data.provisioning_key}` });
  const saved = await admin.from("sidequest_stripe_accounts").update({ account_id: account.id }).eq("user_id", userId).eq("environment", config.environment);
  if (saved.error) throw new Error("Could not save connection");
  return account.id;
}

export async function createStripeOnboardingLink(stripe: Stripe, accountId: string, origin: string) {
  const link = await stripe.v2.core.accountLinks.create({ account: accountId, use_case: { type: "account_onboarding", account_onboarding: { return_url: `${origin}/account?stripe=returned`, refresh_url: `${origin}/account/stripe/refresh` } } });
  return link.url;
}

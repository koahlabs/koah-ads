import { canConnectStripe, type DashboardData, type StripeStatus } from "./dashboard.ts";

export type ConnectionState = { error: string };
type ConnectionDependencies = {
  readDashboard: () => Promise<DashboardData>;
  readAccountId: () => Promise<string | null>;
  createAccount: (country: string) => Promise<string>;
  readStatus: (accountId: string) => Promise<StripeStatus>;
  onboardingLink: (accountId: string) => Promise<string>;
  dashboardLink: (accountId: string) => Promise<string>;
};

// No balance, user ID, or Stripe account ID comes from the browser.
export async function connectPayoutAccount(country: unknown, allowedCountries: string[], dependencies: ConnectionDependencies): Promise<{ error: string; url?: string }> {
  try {
    let accountId = await dependencies.readAccountId();
    if (!accountId) {
      const dashboard = await dependencies.readDashboard();
      if (!dashboard.available) return { error: "We could not verify your balance. Refresh the page and try again." };
      if (!canConnectStripe(dashboard.balanceCents)) return { error: "Stripe setup unlocks when your available balance exceeds $10.00." };
      if (typeof country !== "string" || !allowedCountries.includes(country)) return { error: "Select your country of residence." };
      accountId = await dependencies.createAccount(country);
    }
    const status = await dependencies.readStatus(accountId);
    if (status === "unavailable") return { error: "Stripe is unavailable right now. Try again shortly." };
    const url = status === "connected" ? await dependencies.dashboardLink(accountId) : await dependencies.onboardingLink(accountId);
    const destination = new URL(url);
    if (destination.protocol !== "https:" || !["connect.stripe.com", "accounts.stripe.com"].includes(destination.hostname)) throw new Error("Invalid Stripe destination");
    return { error: "", url };
  } catch {
    return { error: "We could not connect to Stripe. Your balance has not changed. Try again." };
  }
}

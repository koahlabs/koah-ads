import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/account-dashboard";
import { getAuthOrigin, isLocalHttp } from "@/lib/auth-policy";
import { createClient } from "@/lib/supabase/server";
import { getDashboard, getSetupStatus } from "@/lib/dashboard-server";
import { getStripeConfig, getStripeStatus } from "@/lib/stripe-connect-server";

export const metadata: Metadata = {
  title: "Overview | Sidequest",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const supabase = await createClient({ readOnly: true });
  if (!supabase) redirect("/sign-in");
  const result = await supabase.auth.getUser().catch(() => null);
  if (!result || (result.error && (!result.error.status || result.error.status >= 500)))
    redirect("/sign-in?error=provider");
  if (result.error || !result.data.user) redirect("/sign-in?error=session");
  const user = result.data.user;
  const name =
    typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name
      : user.email?.split("@")[0] || "Your account";
  const [data, stripeStatus, setup, query] = await Promise.all([
    getDashboard(supabase, user),
    getStripeStatus(supabase, user.id),
    getSetupStatus(supabase),
    searchParams,
  ]);
  const notice =
    query.stripe === "unavailable"
      ? "We could not refresh your Stripe link. Try connecting again."
      : query.stripe === "returned" && stripeStatus === "incomplete"
        ? "Stripe setup is not complete. Continue below to finish your details."
        : "";
  // A local site needs the plugin pointed at it; production needs nothing extra.
  const origin = getAuthOrigin(`http://${(await headers()).get("host")}`);
  const localSite = isLocalHttp(new URL(origin)) ? origin : undefined;
  return (
    <AccountDashboard
      name={name}
      email={user.email || ""}
      data={data}
      stripeStatus={stripeStatus}
      countries={getStripeConfig()?.countries || []}
      notice={notice}
      setup={setup}
      localSite={localSite}
    />
  );
}

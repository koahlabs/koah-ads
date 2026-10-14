import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/account-dashboard";
import { createClient } from "@/lib/supabase/server";
import { signInEnabled } from "@/lib/feature-flags";
import { getDashboard } from "@/lib/dashboard-server";
import { getStripeConfig, getStripeStatus } from "@/lib/stripe-connect-server";

export const metadata: Metadata = { title: "Overview | Sidequest", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ days?: string; metric?: string; stripe?: string }> }) {
  if (!await signInEnabled()) redirect("/");
  const supabase = await createClient({ readOnly: true });
  if (!supabase) redirect("/sign-in");
  const result = await supabase.auth.getUser().catch(() => null);
  if (!result || (result.error && (!result.error.status || result.error.status >= 500))) redirect("/sign-in?error=provider");
  if (result.error || !result.data.user) redirect("/sign-in?error=session");
  const user = result.data.user;
  const name = typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim() ? user.user_metadata.full_name : user.email?.split("@")[0] || "Your account";
  const [data, stripeStatus, query] = await Promise.all([getDashboard(supabase), getStripeStatus(supabase, user.id), searchParams]);
  const days = ["7", "30", "90"].includes(query.days || "") ? Number(query.days) : 30;
  const metric = query.metric === "impressions" ? "impressions" : "earnings";
  const notice = query.stripe === "unavailable" ? "We could not refresh your Stripe link. Try connecting again." : query.stripe === "returned" && stripeStatus === "incomplete" ? "Stripe setup is not complete. Continue below to finish your details." : "";
  return <AccountDashboard name={name} email={user.email || ""} data={data} stripeStatus={stripeStatus} countries={getStripeConfig()?.countries || []} days={days} metric={metric} notice={notice} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountDashboard } from "@/components/account-dashboard";
import { DashboardPreviewTheme } from "@/components/dashboard-preview-theme";
import { emptyDashboard, type DashboardData, type StripeStatus } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard preview | Sidequest", robots: { index: false, follow: false } };

function sampleData(state: string): DashboardData {
  const asOf = "2026-10-13";
  if (state === "unavailable") return emptyDashboard(false, asOf);
  if (state === "empty") return emptyDashboard(true, asOf);
  const totalEarnedCents = state === "earning" ? 621 : state === "threshold" ? 1000 : state === "connected" ? 4268 : 1868;
  const weights = Array.from({ length: 90 }, (_, index) => index < 44 ? 0 : Math.round((index - 36) * (1 + Math.sin(index * 1.7) * .45)));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const amounts = weights.map(weight => Math.floor(weight / weightTotal * totalEarnedCents));
  amounts[89] += totalEarnedCents - amounts.reduce((sum, value) => sum + value, 0);
  const end = new Date(`${asOf}T00:00:00Z`).getTime();
  const daily = amounts.map((earnedCents, index) => ({ date: new Date(end - (89 - index) * 86_400_000).toISOString().slice(0, 10), impressions: Math.round(earnedCents * .96), earnedCents }));
  const paidOutCents = state === "connected" ? 2400 : 0;
  return { available: true, totalEarnedCents, totalImpressions: daily.reduce((sum, item) => sum + item.impressions, 0), balanceCents: totalEarnedCents - paidOutCents, paidOutCents, pendingPayoutCents: 0, daily, asOf, payouts: state === "connected" ? [{ id: "preview-1", date: "2026-10-08", amountCents: 1200, status: "paid" }, { id: "preview-2", date: "2026-09-25", amountCents: 1200, status: "paid" }] : [] };
}

export default async function DashboardPreview({ searchParams }: { searchParams: Promise<{ state?: string; days?: string; metric?: string; theme?: string }> }) {
  // This route never bypasses authentication in a production build.
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  const states = { empty: "New account", earning: "Below $10", threshold: "Exactly $10", eligible: "Above $10", connected: "Connected", unavailable: "Unavailable" };
  const state = Object.hasOwn(states, query.state || "") ? query.state! : "earning";
  const days = ["7", "30", "90"].includes(query.days || "") ? Number(query.days) : 30;
  const metric = query.metric === "impressions" ? "impressions" : "earnings";
  const stripeStatus: StripeStatus = state === "connected" ? "connected" : state === "unavailable" ? "unavailable" : "not_connected";
  const theme = query.theme === "dark" || query.theme === "light" ? query.theme : undefined;
  return <><DashboardPreviewTheme theme={theme} /><aside className="dashboard-preview-bar" aria-label="Dashboard design preview"><span>Design preview · Sample data</span><nav aria-label="Preview state">{Object.entries(states).map(([value, label]) => <Link key={value} href={`/account/preview?state=${value}&days=${days}&metric=${metric}${theme ? `&theme=${theme}` : ""}`} aria-current={state === value ? "page" : undefined}>{label}</Link>)}<Link href={`/account/preview?state=${state}&days=${days}&metric=${metric}&theme=${theme === "dark" ? "light" : "dark"}`}>{theme === "dark" ? "Light theme" : "Dark theme"}</Link></nav></aside><AccountDashboard name="Alex Morgan" email="alex@example.com" data={sampleData(state)} stripeStatus={stripeStatus} countries={["US", "CA", "GB"]} days={days} metric={metric} preview /></>;
}

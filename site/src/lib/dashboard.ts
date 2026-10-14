export const PAYOUT_THRESHOLD_CENTS = 1_000;

export type DailyActivity = { date: string; impressions: number; earnedCents: number };
export type Payout = { id: string; date: string; amountCents: number; status: "paid" | "pending" | "failed" };
export type DashboardData = {
  available: boolean;
  totalImpressions: number;
  totalEarnedCents: number;
  paidOutCents: number;
  pendingPayoutCents: number;
  balanceCents: number;
  daily: DailyActivity[];
  payouts: Payout[];
  asOf: string;
};
export type StripeStatus = "not_connected" | "incomplete" | "connected" | "unavailable";

export function canConnectStripe(balanceCents: number) {
  return Number.isSafeInteger(balanceCents) && balanceCents > PAYOUT_THRESHOLD_CENTS;
}

export function centsUntilStripe(balanceCents: number) {
  return Math.max(0, PAYOUT_THRESHOLD_CENTS + 1 - balanceCents);
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatCount(count: number) {
  return new Intl.NumberFormat("en-US").format(count);
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

export function emptyDashboard(available = false, asOf = new Date().toISOString().slice(0, 10)): DashboardData {
  return { available, totalImpressions: 0, totalEarnedCents: 0, paidOutCents: 0, pendingPayoutCents: 0, balanceCents: 0, daily: [], payouts: [], asOf };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid dashboard record");
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid dashboard amount");
  return parsed;
}

function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Invalid dashboard date");
  return value;
}

// The server calls an RLS-protected RPC. Reject malformed amounts rather than
// displaying partial totals or allowing an uncertain balance to unlock Stripe.
export function parseDashboard(value: unknown): DashboardData {
  const row = record(value);
  const totalEarnedCents = count(row.total_earned_cents);
  const paidOutCents = count(row.paid_out_cents);
  const pendingPayoutCents = count(row.pending_payout_cents);
  if (!Number.isSafeInteger(paidOutCents + pendingPayoutCents)) throw new Error("Invalid payout total");
  if (!Array.isArray(row.daily) || !Array.isArray(row.payouts)) throw new Error("Invalid dashboard activity");
  return {
    available: true,
    totalImpressions: count(row.total_impressions),
    totalEarnedCents,
    paidOutCents,
    pendingPayoutCents,
    balanceCents: Math.max(0, totalEarnedCents - paidOutCents - pendingPayoutCents),
    asOf: date(row.as_of),
    daily: row.daily.map(value => {
      const item = record(value);
      return { date: date(item.date), impressions: count(item.impressions), earnedCents: count(item.earned_cents) };
    }),
    payouts: row.payouts.map(value => {
      const item = record(value);
      if (typeof item.id !== "string" || typeof item.status !== "string" || !["paid", "pending", "failed"].includes(item.status)) throw new Error("Invalid payout");
      return { id: item.id, date: date(item.date), amountCents: count(item.amount_cents), status: item.status as Payout["status"] };
    }),
  };
}

export function recentActivity(daily: DailyActivity[], days: number, asOf: string): DailyActivity[] {
  const entries = new Map(daily.map(item => [item.date, item]));
  const end = new Date(`${asOf}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return entries.get(date) || { date, impressions: 0, earnedCents: 0 };
  });
}

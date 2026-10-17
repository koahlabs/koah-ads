export const PAYOUT_THRESHOLD_CENTS = 1_000;

export type DailyActivity = { date: string; impressions: number; earnedCents: number };
export type Payout = {
  id: string;
  date: string;
  amountCents: number;
  status: "paid" | "pending" | "failed";
};
export type DashboardData = {
  available: boolean;
  totalImpressions: number;
  totalEarnedCents: number;
  paidOutCents: number;
  pendingPayoutCents: number;
  balanceCents: number;
  daily: DailyActivity[];
  payouts: Payout[];
  /** When the data was read, as an ISO timestamp. */
  asOf: string;
};
export type KoahEarning = { date: string; impressions: number; revenueCents: number };
export type PayoutsRow = {
  paid_out_cents: number;
  pending_payout_cents: number;
  payouts: { id: string; date: string; amount_cents: number; status: Payout["status"] }[];
};
export type SetupDevice = {
  connectedAt: string;
  lastRequestAt: string | null;
};
export type SetupStatus = { hasQueries: boolean; devices: SetupDevice[] };
export type StripeStatus = "not_connected" | "incomplete" | "connected" | "unavailable";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const count = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function canConnectStripe(balanceCents: number) {
  return balanceCents > PAYOUT_THRESHOLD_CENTS;
}

export function centsUntilStripe(balanceCents: number) {
  return Math.max(0, PAYOUT_THRESHOLD_CENTS + 1 - balanceCents);
}

export function formatMoney(cents: number) {
  return money.format(cents / 100);
}

export function formatCount(total: number) {
  return count.format(total);
}

export function formatDate(isoDate: string) {
  return shortDate.format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatFullDate(isoDate: string) {
  return fullDate.format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatAgo(iso: string, now: number) {
  const seconds = Math.floor((now - Date.parse(iso)) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return formatFullDate(iso.slice(0, 10));
}

export function unavailableDashboard(): DashboardData {
  return {
    available: false,
    totalImpressions: 0,
    totalEarnedCents: 0,
    paidOutCents: 0,
    pendingPayoutCents: 0,
    balanceCents: 0,
    daily: [],
    payouts: [],
    asOf: new Date().toISOString(),
  };
}

export function dashboardFromSources(
  earnings: KoahEarning[],
  row: PayoutsRow,
  asOf: string,
): DashboardData {
  const totalImpressions = earnings.reduce((sum, day) => sum + day.impressions, 0);
  const totalEarnedCents = earnings.reduce((sum, day) => sum + day.revenueCents, 0);
  return {
    available: true,
    totalImpressions,
    totalEarnedCents,
    paidOutCents: row.paid_out_cents,
    pendingPayoutCents: row.pending_payout_cents,
    balanceCents: Math.max(0, totalEarnedCents - row.paid_out_cents - row.pending_payout_cents),
    daily: earnings.map((day) => ({
      date: day.date,
      impressions: day.impressions,
      earnedCents: day.revenueCents,
    })),
    payouts: row.payouts.map((payout) => ({
      id: payout.id,
      date: payout.date,
      amountCents: payout.amount_cents,
      status: payout.status,
    })),
    asOf,
  };
}

export function recentActivity(
  daily: DailyActivity[],
  days: number,
  asOf: string,
): DailyActivity[] {
  const entries = new Map(daily.map((item) => [item.date, item]));
  const end = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return entries.get(day) || { date: day, impressions: 0, earnedCents: 0 };
  });
}

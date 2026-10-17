import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canConnectStripe,
  centsUntilStripe,
  dashboardFromSources,
  formatAgo,
  recentActivity,
} from "../src/lib/dashboard.ts";

const earnings = [
  { date: "2026-10-12", impressions: 30, revenueCents: 70 },
  { date: "2026-10-13", impressions: 10, revenueCents: 20 },
];

function row(overrides = {}) {
  return {
    paid_out_cents: 30,
    pending_payout_cents: 20,
    payouts: [{ id: "1", date: "2026-10-12", amount_cents: 30, status: "paid" }],
    ...overrides,
  };
}

test("new Stripe connections require a balance strictly above $10", () => {
  assert.equal(canConnectStripe(1000), false);
  assert.equal(canConnectStripe(1001), true);
  assert.equal(centsUntilStripe(1000), 1);
  assert.equal(centsUntilStripe(1001), 0);
});

test("the dashboard adds Koah earnings to the payouts and subtracts paid and pending from the balance", () => {
  assert.deepEqual(dashboardFromSources(earnings, row(), "2026-10-13"), {
    available: true,
    totalImpressions: 40,
    totalEarnedCents: 90,
    paidOutCents: 30,
    pendingPayoutCents: 20,
    balanceCents: 40,
    daily: [
      { date: "2026-10-12", impressions: 30, earnedCents: 70 },
      { date: "2026-10-13", impressions: 10, earnedCents: 20 },
    ],
    payouts: [{ id: "1", date: "2026-10-12", amountCents: 30, status: "paid" }],
    asOf: "2026-10-13",
  });
});

test("an overpaid account shows a zero balance", () => {
  const overpaid = row({ paid_out_cents: 500 });
  assert.equal(dashboardFromSources(earnings, overpaid, "2026-10-13").balanceCents, 0);
});

test("an account without Koah earnings shows zero totals", () => {
  const data = dashboardFromSources(
    [],
    row({ paid_out_cents: 0, pending_payout_cents: 0 }),
    "2026-10-13",
  );
  assert.equal(data.totalEarnedCents, 0);
  assert.equal(data.balanceCents, 0);
});

test("days without Koah earnings show as zero in the daily series", () => {
  const data = dashboardFromSources(earnings, row(), "2026-10-14");
  const days = recentActivity(data.daily, 3, data.asOf);
  assert.deepEqual(
    days.map((day) => [day.date, day.impressions, day.earnedCents]),
    [
      ["2026-10-12", 30, 70],
      ["2026-10-13", 10, 20],
      ["2026-10-14", 0, 0],
    ],
  );
});

test("daily periods include zero days and use UTC across month and year boundaries", () => {
  const days = recentActivity(
    [{ date: "2025-12-31", impressions: 10, earnedCents: 20 }],
    7,
    "2026-01-03",
  );
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2025-12-28");
  assert.equal(days[6].date, "2026-01-03");
  assert.equal(
    days.reduce((sum, day) => sum + day.impressions, 0),
    10,
  );
  assert.equal(days[3].earnedCents, 20);
  assert.equal(recentActivity([], 90, "2026-10-13").length, 90);
});

test("relative time reads from just now to a date", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  const ago = (seconds) => formatAgo(new Date(now - seconds * 1000).toISOString(), now);
  assert.equal(ago(-3), "just now");
  assert.equal(ago(4), "just now");
  assert.equal(ago(12), "12 s ago");
  assert.equal(ago(240), "4 min ago");
  assert.equal(ago(3 * 3600 + 60), "3 h ago");
  assert.equal(ago(2 * 86_400), "Oct 14, 2026");
});

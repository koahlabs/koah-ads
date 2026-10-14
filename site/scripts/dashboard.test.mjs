import { test } from "node:test";
import assert from "node:assert/strict";
import { canConnectStripe, centsUntilStripe, emptyDashboard, parseDashboard, recentActivity } from "../src/lib/dashboard.ts";
import { connectPayoutAccount } from "../src/lib/payout-connection.ts";

function row(overrides = {}) {
  return { as_of: "2026-10-13", total_impressions: 2400, total_earned_cents: 4268, paid_out_cents: 2400, pending_payout_cents: 500, daily: [], payouts: [], ...overrides };
}

function dependencies(balanceCents, overrides = {}) {
  const calls = [];
  return {
    calls,
    readDashboard: async () => ({ ...emptyDashboard(true), balanceCents }),
    readAccountId: async () => null,
    createAccount: async country => { calls.push(["create", country]); return "acct_test"; },
    readStatus: async accountId => { calls.push(["status", accountId]); return "incomplete"; },
    onboardingLink: async accountId => { calls.push(["onboarding", accountId]); return "https://accounts.stripe.com/r/acct_test"; },
    dashboardLink: async accountId => { calls.push(["dashboard", accountId]); return "https://connect.stripe.com/express/acct_test/link"; },
    ...overrides,
  };
}

test("new Stripe connections require a verified balance strictly above $10", async () => {
  for (const amount of [0, 999, 1000]) {
    const provider = dependencies(amount);
    const result = await connectPayoutAccount("US", ["US"], provider);
    assert.match(result.error, /exceeds \$10/);
    assert.equal(result.url, undefined);
    assert.deepEqual(provider.calls, []);
  }
  const provider = dependencies(1001);
  const result = await connectPayoutAccount("US", ["US"], provider);
  assert.equal(result.url, "https://accounts.stripe.com/r/acct_test");
  assert.deepEqual(provider.calls, [["create", "US"], ["status", "acct_test"], ["onboarding", "acct_test"]]);
  assert.equal(centsUntilStripe(1000), 1);
  assert.equal(centsUntilStripe(1001), 0);
  for (const invalid of [NaN, Infinity, 1000.1, "2000", Number.MAX_SAFE_INTEGER + 1]) assert.equal(canConnectStripe(invalid), false);
});

test("unavailable earnings and invalid countries cannot create Stripe accounts", async () => {
  const missing = dependencies(2000, { readDashboard: async () => emptyDashboard() });
  assert.match((await connectPayoutAccount("US", ["US"], missing)).error, /verify/);
  assert.deepEqual(missing.calls, []);
  for (const country of [null, "CA", "us", "<script>", new Blob(["US"])]) {
    const provider = dependencies(2000);
    assert.match((await connectPayoutAccount(country, ["US"], provider)).error, /country/);
    assert.deepEqual(provider.calls, []);
  }
});

test("existing users retain Stripe access after payouts reduce their balance", async () => {
  const provider = dependencies(0, {
    readAccountId: async () => "acct_owned",
    readDashboard: async () => { throw new Error("Existing accounts need no new balance check"); },
    readStatus: async () => "connected",
  });
  const result = await connectPayoutAccount(null, ["US"], provider);
  assert.equal(result.error, "");
  assert.deepEqual(provider.calls, [["dashboard", "acct_owned"]]);
  const unfinished = dependencies(0, { readAccountId: async () => "acct_owned" });
  assert.ok((await connectPayoutAccount(null, ["US"], unfinished)).url);
  assert.deepEqual(unfinished.calls, [["status", "acct_owned"], ["onboarding", "acct_owned"]]);
});

test("Stripe failures show a safe error and reject non-Stripe redirects", async () => {
  const failed = dependencies(2000, { createAccount: async () => { throw new Error("secret provider details"); } });
  assert.doesNotMatch((await connectPayoutAccount("US", ["US"], failed)).error, /secret provider/);
  for (const url of ["https://attacker.example", "http://accounts.stripe.com", "https://accounts.stripe.com.attacker.example", "javascript:alert(1)"]) {
    const provider = dependencies(2000, { onboardingLink: async () => url });
    const result = await connectPayoutAccount("US", ["US"], provider);
    assert.equal(result.url, undefined);
    assert.match(result.error, /balance has not changed/);
  }
});

test("balances deduct paid and pending payouts and fail closed on malformed data", () => {
  const data = parseDashboard(row());
  assert.equal(data.balanceCents, 1368);
  assert.equal(parseDashboard(row({ total_earned_cents: "4268" })).balanceCents, 1368);
  assert.equal(parseDashboard(row({ total_earned_cents: 100 })).balanceCents, 0);
  for (const total_earned_cents of ["1000.01", -1, NaN, Infinity, 10.5, "bad", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseDashboard(row({ total_earned_cents })));
  for (const as_of of ["invalid", "2026-02-30", "2026-13-10"]) assert.throws(() => parseDashboard(row({ as_of })));
  assert.throws(() => parseDashboard(row({ payouts: [{ id: "1", date: "2026-10-13", amount_cents: 100, status: "invented" }] })));
});

test("daily periods include zero days and use UTC across month and year boundaries", () => {
  const days = recentActivity([{ date: "2025-12-31", impressions: 10, earnedCents: 20 }], 7, "2026-01-03");
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2025-12-28");
  assert.equal(days[6].date, "2026-01-03");
  assert.equal(days.reduce((sum, day) => sum + day.impressions, 0), 10);
  assert.equal(days[3].earnedCents, 20);
  assert.equal(recentActivity([], 90, "2026-10-13").length, 90);
});

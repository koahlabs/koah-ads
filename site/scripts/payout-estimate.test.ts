import { test } from "bun:test";
import assert from "node:assert/strict";
import { estimatedPayoutCents, payoutDigits } from "../src/lib/payout-estimate.ts";

const model = {
  impressions: 1_000,
  periodStart: "2026-10-04T00:00:00Z",
  periodEnd: "2026-10-05T00:00:00Z",
  cpmCents: 1_500,
  sharePercent: 70,
};
const end = Date.parse(model.periodEnd);

test("$15 CPM with a 70% share pays $10.50 per 1,000 modeled impressions", () => {
  assert.equal(estimatedPayoutCents(model, end), 1_050);
});

test("the estimate grows linearly after the period and never counts backward", () => {
  assert.equal(estimatedPayoutCents(model, end + 43_200_000), 1_575);
  assert.equal(estimatedPayoutCents(model, end + 86_400_000), 2_100);
  assert.equal(estimatedPayoutCents(model, end - 1), 1_050);
});

test("partial cents round down", () => {
  assert.equal(estimatedPayoutCents({ ...model, impressions: 1_001 }, end), 1_051);
});

test("a zero-impression period stays at zero and malformed models fail", () => {
  assert.equal(estimatedPayoutCents({ ...model, impressions: 0 }, end + 86_400_000), 0);
  for (const invalid of [
    { periodEnd: model.periodStart },
    { impressions: -1 },
    { impressions: 1.5 },
    { cpmCents: -1 },
    { sharePercent: 101 },
    { periodStart: "invalid" },
  ]) {
    assert.throws(() => estimatedPayoutCents({ ...model, ...invalid }, end), RangeError);
  }
  assert.throws(() => estimatedPayoutCents(model, NaN), RangeError);
});

test("the board uses eight number positions beside the currency tile and preserves large totals", () => {
  assert.equal(payoutDigits(1_234_567), "012,345.67");
  assert.equal(payoutDigits(0), "000,000.00");
  assert.equal(payoutDigits(100_000_000), "1,000,000.00");
  assert.equal(payoutDigits(1_000_000_000), "10,000,000.00");
  assert.throws(() => payoutDigits(-1), RangeError);
});

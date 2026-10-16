import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimatedPayoutCents,
  payoutDigits,
  koahPayoutEstimate,
} from "../src/lib/payout-estimate.ts";

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

test("the epoch model grows at the measured pace across reloads and time zones", () => {
  assert.equal(estimatedPayoutCents(model, end + 43_200_000), 1_575);
  assert.equal(estimatedPayoutCents(model, end + 86_400_000), 2_100);
  assert.equal(estimatedPayoutCents(model, Date.parse("2026-10-05T20:00:00-04:00")), 2_100);
  assert.equal(estimatedPayoutCents(model, end - 1), 1_050);
});

test("the measured seven-day baseline and its daily extension retain cent precision", () => {
  const seriesEnd = Date.parse(koahPayoutEstimate.periodEnd);
  assert.equal(estimatedPayoutCents(koahPayoutEstimate, seriesEnd), 2_202_680);
  assert.equal(estimatedPayoutCents(koahPayoutEstimate, seriesEnd + 86_400_000), 2_517_349);
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
  assert.equal(payoutDigits(2_202_680), "022,026.80");
  assert.equal(payoutDigits(0), "000,000.00");
  assert.equal(payoutDigits(100_000_000), "1,000,000.00");
  assert.equal(payoutDigits(1_000_000_000), "10,000,000.00");
  assert.throws(() => payoutDigits(-1), RangeError);
});

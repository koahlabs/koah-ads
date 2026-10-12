export type PayoutEstimate = {
  impressions: number;
  periodStart: string;
  periodEnd: string;
  cpmCents: number;
  sharePercent: number;
};

// Measured paid Koah-native served impressions, not a record of settled payments.
// Provenance and exclusions: docs/payout-estimate.md.
export const koahPayoutEstimate: PayoutEstimate = {
  impressions: 2_097_791,
  periodStart: "2026-10-04T00:00:00Z",
  periodEnd: "2026-10-11T00:00:00Z",
  cpmCents: 1_500,
  sharePercent: 70,
};

export function estimatedPayoutCents(model: PayoutEstimate, now: number): number {
  const start = Date.parse(model.periodStart);
  const end = Date.parse(model.periodEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || !Number.isFinite(now) || !Number.isSafeInteger(model.impressions) || model.impressions < 0
    || !Number.isFinite(model.cpmCents) || model.cpmCents < 0
    || !Number.isFinite(model.sharePercent) || model.sharePercent < 0 || model.sharePercent > 100) {
    throw new RangeError("Invalid payout estimate inputs");
  }

  // Extend the completed period at its observed average pace. Never count backward.
  const estimatedImpressions = model.impressions * (1 + Math.max(0, now - end) / (end - start));
  const cents = estimatedImpressions * model.cpmCents / 1_000 * model.sharePercent / 100;
  if (cents > Number.MAX_SAFE_INTEGER) throw new RangeError("Payout estimate exceeds safe integer precision");
  return Math.floor(cents);
}

export function payoutDigits(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("Invalid payout amount");
  const whole = Math.floor(cents / 100).toString().padStart(6, "0");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(cents % 100).toString().padStart(2, "0")}`;
}

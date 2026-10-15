# Footer payout estimate

The home page shows a **modeled Koah network payout amount**, not Sidequest earnings, payment transactions, or reconciled money already paid. The visible label is “Payouts”; the accessible description and tooltip identify the Koah network. The tooltip includes the start date and calculation. The board uses nine tiles for the current amount: one dollar sign, six whole-dollar digits, and two cent digits. Larger amounts preserve their full value by adding digits.

## Measured input

Source: Metabase `mb` CLI, **Clickhouse Analytics Prod (database 4)**, `analytics` clean CDC tables. Retrieved October 11, 2026. Metric: **unregistered estimate**, using standard query-grain V2-valid served impression rows from paid Koah-native campaigns. It retains every qualifying impression, including multiple responses to one query.

Query: `scripts/analytics/payout-impressions.sql`.

Completed UTC period: `[2026-10-04T00:00:00Z, 2026-10-11T00:00:00Z)`.

| UTC day    | Qualifying impressions |
| ---------- | ---------------------: |
| October 4  |                301,235 |
| October 5  |                315,442 |
| October 6  |                318,058 |
| October 7  |                296,413 |
| October 8  |                295,661 |
| October 9  |                298,732 |
| October 10 |                272,250 |
| Total      |              2,097,791 |

All sources use `FINAL` and `_cdc_deleted = 0`. The query excludes demo publishers, demo advertisers, demo teams, forced preview queries, archived ads/ad groups/campaigns, house/affiliate campaigns, and programmatic sentinel ads. Impressions must fall between query creation and the inclusive V2 48-hour validity boundary.

Validation: the independent ungrouped paid total was 2,097,791, equal to the sum of all seven daily rows. `count()` equaled `uniqExact(impression_id)` at the initial valid, publisher, and paid stages; none of the joins duplicated impressions. The publisher stage retained all 2,269,567 valid impressions. The paid-campaign stage reduced that total to 2,097,791. Neither result was truncated.

## Model

The user supplied **$15 CPM** and selected a **70% payout share**. These are model assumptions, not observed campaign rates or reconciled payouts.

- Average daily impressions: `2,097,791 / 7 = 299,684.428571...`.
- Payout estimate per 1,000 impressions: `$15 × 70% = $10.50`.
- Completed-period estimate: `$22,026.8055`.
- Estimated daily increase: `$3,146.6865`.
- Estimated increase per second: `$0.036419982638...`.

`src/lib/payout-estimate.ts` adds projected impressions after the period end at the observed seven-day average. It calculates the dollar amount from Unix time, rounds down to cents only at display time, and clamps dates before the snapshot to the measured baseline. Reloading does not reset the amount. Changing browser time zones does not change the calculation.

The model does **not** account for actual CPC/CPM rates, response price snapshots, contract advertiser lanes, publisher revenue multipliers, custom fixed-eCPM terms, affiliate or programmatic payment sources, Stripe/Mercury reconciliation, payout cycles, payment overrides, or real settlement records. Use `Reconciliation::RevenueReconciler` output before making claims about actual payouts.

## Refresh

Run the same query for seven recent completed UTC days. Reconcile daily rows with an ungrouped total and check uniqueness before replacing `koahPayoutEstimate`. Update the measured period and this record together. The counter derives its visible start date from the model.

The server supplies a current initial amount per request, so the first frame does not reset to the snapshot baseline. The counter updates once per second while visible. It pauses its timer offscreen or in a hidden tab and resumes at the current estimate. Reduced-motion users receive the same amounts without the flip animation. The corner dither background also pauses in hidden tabs and becomes static with reduced motion.

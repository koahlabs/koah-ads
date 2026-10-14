# Account dashboard

`/account` verifies the Supabase user and respects the existing `sign-in-enabled` flag. Earnings and impressions for the selected 7/30/90-day period appear once, as the controls for a shared activity chart. The balance column shows the available balance, total completed payouts, and Stripe setup. **View activity details** expands all-time earnings, all-time impressions, and the daily table. Payout history shows the latest ten payouts. The activity period and metric persist in the URL. Daily dates use UTC. The page supports the existing light/dark theme, narrow screens, keyboard controls, and reduced motion.

The UI follows the monochrome palette, Geist typography, shared alignment, tabular figures, and restrained surfaces from [Vercel's design.md](https://vercel.com/design.md). Its separation of activity, balances, and detailed records follows [Stripe's dashboard structure](https://docs.stripe.com/dashboard/basics). It retains Sidequest's branding and existing theme tokens. Empty accounts show a concise message instead of an empty chart with zero-valued axes.

## Preview the design

Run `npm run dev`, then open `/account/preview`. The preview has six states: a new account, a balance below $10, a balance of exactly $10, a balance above $10, a connected account, and unavailable data. It displays a sample-data banner. The preview does not call Stripe or sign out a real account. Production builds return 404 for this route.

## Prepare the data source

Apply `supabase/migrations/202610130001_dashboard.sql` to the Supabase project used for authentication. This creates three tables and the `sidequest_dashboard()` RPC. All tables use row-level security. Authenticated users can only read their own rows. Only the service role can write earnings, payouts, or Stripe account mappings. The RPC uses `SECURITY INVOKER`, derives the user from `auth.uid()`, and cannot request another user's data.

Connect the trusted revenue pipeline to `sidequest_daily_earnings` using the authenticated Sidequest user's UUID. Upsert one row per UTC day with actual impression counts and the user's actual revenue share in integer USD cents. Do not multiply impressions by the landing page's illustrative CPM. The current plugin's random machine identifier is not an authenticated account ID; map a verified plugin installation to the user before ingesting earnings. This change does not add that installation link or generate credits.

Record payouts in `sidequest_payouts`. The balance equals earned cents minus paid and pending payouts, with a minimum of zero. Failed payouts do not reduce the balance. Use a unique `provider_reference` for each payout. Only mark a payout `paid` after the provider confirms completion. Handle payout transitions through verified provider webhooks in the revenue/payout service. This dashboard does not initiate transfers or payouts.

Before the migration is applied, or if the data source fails, the page shows unavailable values and a refresh action. It does not display fabricated zero balances. After the migration, a new account correctly shows zero earnings and no activity.

## Configure Stripe Connect

Set these server-only values in local development and the deployment's sensitive environment variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase `sb_secret_` key; the dashboard uses it to reserve and persist Stripe account mappings. The waitlist counter also uses this server-only key. |
| `STRIPE_CONNECT_KEY` | Prefer a restricted Stripe key with Accounts v2, account links, account retrieval, and Express login-link permissions. |
| `STRIPE_CONNECT_ENVIRONMENT` | Unique namespace for this Stripe platform/sandbox, such as `development-sandbox` or `live`. Never reuse a sandbox namespace for another Stripe account. |
| `STRIPE_CONNECT_COUNTRIES` | Comma-separated recipient countries supported and enabled on this Connect platform, such as `US,CA`. |

Use a dedicated Stripe sandbox for development. Vercel Production rejects sandbox keys. Enable Connect and Accounts v2 on the Stripe platform. Verify the allowed countries and USD settlement support before adding countries to the list. The user selects their country of residence before setup; the app does not infer it from location.

New connections require an available, verified balance **strictly above $10.00**: $10.00 stays locked; $10.01 unlocks. The server action re-verifies the authenticated user, reads their current balance, and validates the selected country. It accepts no user ID, balance, account ID, or redirect URL from the browser.

The server creates an Accounts v2 recipient with an Express dashboard and the transfer capability, then opens Stripe-hosted onboarding. It reserves an immutable idempotency key before account creation and stores the resulting account ID. Concurrent submissions reuse that reservation. If an unresolved reservation is older than 23 hours, the server stops creation because Stripe can discard idempotency keys after 24 hours. Reconcile that reservation with Stripe's request logs and save the verified account ID before retrying. Do not delete it and create another account blindly.

Returning from Stripe does not imply completion. Each dashboard request checks the current transfer and payout capability states through Accounts v2. Incomplete accounts offer **Finish Stripe setup**. Active accounts offer an authenticated, one-use Express login link. Existing users retain access after payouts reduce their balance below $10. The refresh route authenticates the user and regenerates an expired onboarding link.

Before enabling live payout execution in the separate payout service, subscribe to and verify the relevant account and payout webhooks. Re-check recipient capabilities before each transfer. Add Stripe's `notification_banner` embedded component if the app later embeds Stripe account management rather than directing users to Express.

## Validation

`npm test` covers the exact $10 boundary, unverified balances, country validation, existing-account access, provider failures, redirect restrictions, integer cents, payout deductions, and UTC activity windows. `npm run lint`, `npx tsc --noEmit`, and `npm run build` verify the app. Tests mock providers and create no Stripe accounts or payments.

Run `scripts/dashboard-rls.test.sql` with `psql -v ON_ERROR_STOP=1 -f scripts/dashboard-rls.test.sql` only in a new disposable local database. It creates mock auth roles, applies the migration, verifies per-user aggregation, and proves that authenticated users cannot create earnings, change Stripe mappings, or remove payouts. It also checks that anonymous callers cannot execute the RPC. Do not run this test on the shared Supabase project.

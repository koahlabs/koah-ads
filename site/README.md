# Sidequest website

A landing page for an upcoming Claude Code and Claude Desktop mod that shares ad revenue with users. Built with Next.js 16, React 19, and Tailwind CSS 4.

## Local development

See [Local development](../README.md#local-development) in the root README. Keep `.env.local` out of Git. The waitlist form returns an explicit error until Loops is configured; it never pretends to store a signup.

## Loops setup

1. Add `LOOPS_API_KEY` to `.env.local`.
2. Set `LOOPS_FROM_EMAIL` to a sender local part on your verified Loops domain. The setup script defaults to `noreply`, the existing sender in the connected Koah account.
3. Run `bun run loops:setup`. It creates the three waitlist contact properties (`muxWaitlistJoinedAt`, `muxWaitlistWelcomeSent`, `muxWaitlistSlackNotified`; the keys keep their original names), creates or reuses the dedicated Sidequest welcome template, uploads `emails/waitlist-welcome.lmx`, publishes the template, and saves `LOOPS_WAITLIST_TRANSACTIONAL_ID` to `.env.local`. The script does not send email or alter unrelated templates.
4. Optionally set `LOOPS_WAITLIST_MAILING_LIST_ID` to an existing list ID. Otherwise, select waitlist contacts in Loops with the filter **muxWaitlistJoinedAt is not empty**.
5. Submit your own email through the site to test the complete flow.

The published welcome email follows Modal's simple text layout: a small sidequest heading, three short paragraphs, an underlined @guard_if link, a linked sidequest heading, and a personal sign-off. It uses the site's black and white colors, thanks the reader, and links to [@guard_if on Twitter / X](https://x.com/guard_if). The sender display name is `guard_if at Sidequest`. Loops appends its configured footer.

The setup script uses the [Loops Content API](https://loops.so/docs/api-reference/create-transactional-email) and native [LMX](https://loops.so/docs/creating-emails/lmx). Re-run it after editing the LMX file. It checks revisions before overwriting a draft.

## Signup behavior

`POST /api/waitlist` accepts `{ "email": "you@example.com", "consent": true, "website": "" }`.

- Validates and normalizes the email, checks the origin, and limits the body size.
- Includes a honeypot and a per-instance limit of eight attempts per client per ten minutes. For a distributed production deployment, configure an edge/WAF rate limit as well.
- Stores each signup and its first join date in Loops. It preserves existing global subscription preferences and other contact fields.
- Sends the published welcome email and records `muxWaitlistWelcomeSent` on the contact.
- Skips welcome email for contacts with a saved welcome marker. Stable provider idempotency keys cover retries and concurrent submissions within Loops' 24-hour deduplication window.
- Reports failures accurately. If contact storage succeeds but email sending fails, a retry resumes the email step.
- Logs only failure stages and status codes. It does not log addresses or API credentials.

The API key remains on the server. The site requires a Node server; static export cannot run the signup route.

## Analytics and Slack signup notifications

The root layout includes Vercel Web Analytics through `@vercel/analytics/next`, following [Vercel's setup guide](https://vercel.com/docs/analytics/quickstart). Enable Web Analytics in the `sidequest-landing` dashboard and deploy the updated site to start collecting page views.

The server also tracks the custom event `waitlist_signup` after Loops saves a new waitlist member. Open **Vercel → sidequest-landing → Analytics → Events → waitlist_signup** and select a date range to see the event count. Custom events require a Pro or Enterprise plan; the connected Koah team uses Enterprise. See [Vercel's custom-event guide](https://vercel.com/docs/analytics/custom-events).

The event has only `source: "waitlist_form"` as custom data. It sends no email address or signup identifier. Existing waitlist members, invalid requests, and failed contact saves do not produce the event. Welcome-email and Slack failures do not change whether the new signup is counted. Next.js runs tracking after the response, so an analytics failure cannot block a signup. Tracking works even when the Slack webhook is unset.

This is the count of newly stored signups after this code is deployed, not the historical Loops waitlist total. Analytics delivery is best effort, and concurrent submissions for the same new address can race before the first contact save becomes visible. Use Loops for the authoritative waitlist total. On deployments protected by Vercel Authentication or a password, server events need Vercel's `VERCEL_AUTOMATION_BYPASS_SECRET`; the SDK uses it automatically when configured. Public production deployments need no additional analytics secret.

New **waitlist** signups send an incoming-webhook message to **#koah-info**, headed **⚔️ Sidequest — new waitlist signup**, with 🔢 for the lead number and 📧 for the normalized email. Account sign-ins do not send messages.

1. Set `SETTINGS__KOAH_INFO_SLACK_URL` to the incoming webhook bound to #koah-info. Keep it server-only in `.env.local` and the Vercel Production environment. Set it in Preview only if preview signups should also post to the channel. Never commit the URL or use a `NEXT_PUBLIC_` variable.
2. Run `bun run slack:setup` to register the `muxWaitlistSlackNotified` boolean in Loops. This only prepares the delivery marker; it does not send a message, send email, or modify email templates. The full `loops:setup` script also registers this property.
3. Deploy the updated site. The webhook's Slack configuration determines the destination channel; the app cannot override it. See [Slack's incoming-webhook guide](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

After Loops saves the signup, Next.js `after` sends the notification in the background. Welcome-email failures do not stop the Slack notification, and Slack failures do not change the signup response. Successful delivery saves the marker in Loops, so later submissions do not send another message. Pending notifications retry if the address submits the form again. Contacts enrolled before this integration, with no notification marker, do not send old signup messages.

Incoming webhooks do not provide an idempotency key. Same-instance concurrent sends are deduplicated, but simultaneous requests across server instances or a failed delivery-marker write can still produce a duplicate. The code retries marker writes without repeating the Slack POST. Provider failures log only stages and status codes, never addresses or webhook URLs.

### Lead numbers, including the existing waitlist

Apply `supabase/migrations/202610160002_waitlist_lead_numbers.sql` and set `SUPABASE_SECRET_KEY` in the server environment. Only the service role can use the counter. Browser sessions cannot read or change it.

Export the current Loops audience as CSV with the `email` and `muxWaitlistJoinedAt` columns. Loops CLI 0.12.0 can find individual contacts but does not provide a bulk contact export or waitlist count. The import includes only contacts with a Sidequest first-join date, normalizes and deduplicates emails, and orders the existing leads by that date. It sends only email hashes to Supabase.

```bash
bun run slack:seed-leads /path/to/loops-export.csv --dry-run
bun run slack:seed-leads /path/to/loops-export.csv
```

The first import gives the existing waitlist its lead numbers. Registration is refused until this import runs. Each new lead receives the next number. Retries and duplicate requests reuse the same number, including across server instances. The import can run again without renumbering known leads. The counter registers new stored leads even when Slack is disabled. If the counter is unavailable, Slack still reports the signup with **Lead number: unavailable**. Reimport a current Loops export after a counter outage to include any leads stored during that outage.

For example:

```text
⚔️ Sidequest — new waitlist signup
🔢 Lead #42
📧 Email: hello@example.com
```

## Checks

```bash
bun run test
bun run build
```

The tests cover input validation, storage failures, repeat signups, email retries, provider conflicts, subscription preservation, rate limiting, Slack delivery, and custom-event eligibility. They mock Loops, Slack, and analytics and send no email, Slack messages, or analytics events.

## Deployment

Add the same `LOOPS_API_KEY`, `LOOPS_WAITLIST_TRANSACTIONAL_ID`, and optional `LOOPS_WAITLIST_MAILING_LIST_ID` to the deployment's server environment. Set `NEXT_PUBLIC_SITE_URL` to the public site URL for social share images, or use Vercel's automatic production URL. Local `.env.local` values do not configure a deployed site.

The page collects waitlist signups for the unreleased mod. Ad previews show illustrative placements and earnings; actual rates and payout details will follow before launch.

## Sign-in

### Show or hide sign-in

Toggle the boolean [`sign-in-enabled` flag in Vercel](https://vercel.com/koah-14ef6421/sidequest-landing/flag/sign-in-enabled). Select the environment, choose **On** or **Off**, then save the change. After the code is deployed, flag changes need no redeployment. Refresh the page after changing the flag; Vercel's SDK may briefly use a cached value while the change reaches the app.

- **On:** shows the Sign in or Account link and enables Google and email sign-in.
- **Off:** hides the link, redirects `/sign-in`, `/account`, and `/auth/callback` to `/`, and blocks new sign-in requests from previously loaded forms. Signing out remains allowed. It does not delete accounts or revoke existing Supabase sessions.

The initial flag is **Off** in Production and Preview and **On** in Development. `src/lib/feature-flags.ts` uses the official Flags SDK with Vercel's OIDC credentials. Vercel supplies these credentials on deployments. For local use, set `FLAGS` as the root README describes. Without a flag value, the fallback is **Off**. This flag controls the website's sign-in feature; Supabase still enforces user authentication and data permissions.

### Google and email links

The shared header opens `/sign-in`. The Google button starts Supabase's PKCE OAuth flow. `/auth/callback` exchanges the one-use code for a cookie session and always returns to `/account`. `/auth/callback/connect` does the same and returns to `/connect`; the `/connect` page uses it. The account page verifies the user through Supabase on the server. Signing out ends the current browser session.

The email form calls Supabase `signInWithOtp` to send a one-use sign-in link. It also creates accounts for new email addresses, without passwords. It keeps the email in the form, shows send failures, and waits 60 seconds before offering another send. Supabase enforces its own server-side rate limits. Email sign-in does not subscribe users to marketing messages.

The default Supabase email template returns to `/auth/callback` using PKCE. Open those links in the browser that requested them. A custom template can instead send `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`; the callback verifies that hash directly, which also supports opening the email in a different browser. Only the `email` verification type is accepted, and the callback always redirects to `/account`.

Before enabling email delivery for public users, configure custom SMTP in Supabase. Its default SMTP service only sends to project team members and limits email volume. For Loops, use `smtp.loops.so`, port `587`, username `loops`, and a Loops API key as the SMTP password. Configure both the **Confirm signup** and **Magic Link** email templates. Keep email confirmation enabled. See [Supabase email links](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp), and [Loops SMTP setup](https://loops.so/docs/smtp/supabase).

Run `bun run loops:auth-setup` to publish the dedicated white-background, black-text sign-in email from `emails/sign-in-link.lmx`. The script does not send email or change the waitlist email. It saves a Loops template ID locally and generates `emails/supabase-sign-in.json`. Paste that JSON into both Supabase's **Confirm signup** and **Magic Link** message bodies after configuring Loops SMTP. The payload uses a token hash and the app's allowed callback URL. Auth links disable Loops click tracking. It does not add recipients to the Loops marketing audience. SMTP credentials stay in Supabase; the Next.js app needs no additional private keys for email sign-in.

The current setup uses the [mux Supabase project](https://supabase.com/dashboard/project/oofxihxdnkqznzndwlbz) and the [mux-landing Google Cloud project](https://console.cloud.google.com/auth/clients?project=koah-mux). The Google web client is named `mux web`. Its authorized callback is `https://oofxihxdnkqznzndwlbz.supabase.co/auth/v1/callback`. Public Supabase settings are configured locally and in Vercel's Production, Preview, and Development environments. Store the Google client secret only in Supabase's Google provider settings.

1. Open the existing Supabase organization through its Vercel Marketplace installation. Create a Supabase project if the organization has none.
2. Connect that resource to the `sidequest-landing` Vercel project. The integration syncs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Older integrations can use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Authentication uses only these public keys. The ad proxy, Stripe connections, and the waitlist counter use the server-only `SUPABASE_SECRET_KEY`.
3. Production and Preview get these public settings from the integration. Local values are in the root README.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://getsidequest.dev` and allow `https://getsidequest.dev/auth/callback`, `https://getsidequest.dev/auth/callback/connect`, `https://mux-landing.vercel.app/auth/callback`, `https://mux-landing.vercel.app/auth/callback/connect`, `http://localhost:3001/auth/callback`, and `http://localhost:3001/auth/callback/connect`. Local Supabase allows the same two `localhost:3001` URLs in `supabase/config.toml`. Keep the `mux-landing.vercel.app` callback: Preview deployments have no `NEXT_PUBLIC_SITE_URL`, so `getAuthOrigin` builds their callback from `VERCEL_PROJECT_PRODUCTION_URL`, which can still be that domain. Production sets `NEXT_PUBLIC_SITE_URL=https://getsidequest.dev`; update it and this allowlist together if the domain changes.
5. In Google Auth Platform, create a web OAuth client using the Supabase callback URL shown by **Authentication → Sign In / Providers → Google**. Enable the `openid`, email, and profile scopes. Configure the audience for the intended users.
6. Save the Google client ID and secret in the Supabase Google provider settings and enable the provider. Do not put the Google secret in Next.js public environment variables.
7. Sign in with a real Google account on the deployed site. Check `/account`, reload, sign out, and confirm `/account` returns to sign-in.

Sign-in and waitlist subscriptions are separate. Google sign-in creates an account but does not add a Loops contact or send marketing email. The website shows an explicit unavailable state until Supabase is configured. Cancelled or failed OAuth flows return to sign-in with safe, fixed messages. Cookies use HttpOnly and SameSite=Lax; production uses Secure cookies. Session responses are private and are not cached.

The auth tests check callback origin restrictions, public-key requirements, email validation, account creation requests, send failures, cooldowns, and configuration/error behavior. They do not replace real Google or email link tests.

## Ad proxy

The Claude Code plugin calls Koah through this site, so the Koah serving token never reaches a user's computer. In production, set `SUPABASE_SECRET_KEY`, `KOAH_SERVING_TOKEN`, and `KOAH_PUBLISHER_ID` (and optionally `KOAH_API_URL`) in the server environment. Apply `supabase/migrations/202610150001_sidequest_devices.sql`.

- `POST /api/device` takes `Authorization: Bearer sq_<43 base64url characters>` and no body. It starts a connection for a key the plugin generated, and returns 201 `{ "userCode": "BCDFGHJK", "expiresAt": "<ISO time>" }`. Pending connections last 10 minutes. It returns 429 when one network (an IPv4 address or an IPv6 /64) already has 10 pending connections, 409 on a key or code collision, and 503 when sign-in is off or the request has no client IP. A server without Supabase configuration fails with 500.
- `GET /api/device` takes the same bearer key and reports the connection. It returns 200 `{ "email": "..." }` when connected, 202 `{}` while pending, 403 `{ "error": "Account suspended" }` when the account is banned, and 404 when the key is unknown or expired. The plugin polls it.
- `POST /api/ad` takes the same bearer key and `{ "question": "...", "answer": "...", "conversationId": "...", "demo": false }`. It looks up the connected user for that device key, forwards the request to Koah's `request_ad` with the user's id and the first `x-forwarded-for` address, and returns Koah's response with `impressionLink` replaced by `impressionId`, the Koah query id. The plugin reports the impression at `POST /api/impression/<impressionId>`. Koah no-fill (204) and rate limits (429) pass through. Other Koah failures return 502. A banned account gets 403; an unconnected key gets 401.
- `POST /api/impression/<id>` takes the same bearer key and reports the impression to Koah, with the same 401 and 403 rules.
- `/connect` takes no query parameters. A signed-in user types the 8-letter code shown in Claude Code (`XXXX-XXXX`). The page then shows when and where the request came from, next to this browser's IP address, and warns if they differ. The user confirms or cancels. The code is never part of a URL, so a link cannot confirm a connection for someone else.

Device keys are stored only as SHA-256 hashes. Codes use the 20 letters `BCDFGHJKLMNPQRSTVWXZ`, expire after 10 minutes, and work once. A signed-in user gets at most 10 failed code lookups per hour. All table access goes through `security definer` functions in the migration; the tables have no RLS policies. `POST /api/ad` makes one call, `sidequest_take_ad_request`, which finds the device, checks for a ban, and counts the request against the daily limit of 500. The other device endpoints call `sidequest_device`, which also checks for a ban.

### Admin: ban an account

Banning uses Supabase Auth's user ban. It blocks sign-in and makes every proxy request for that user return 403.

- Ban: `update auth.users set banned_until = '2999-01-01' where id = '<user id>';`. Unban with `banned_until = null`.
- Find a user's devices: `select key_hash, created_at from sidequest_devices where user_id = '<user id>';`
- Drop one device: `delete from sidequest_devices where key_hash = '<key hash>';`

## Account dashboard

The signed-in `/account` page shows impressions, earnings, daily activity, available balance, and payout history. Days use UTC. The page shows an unavailable state, not zeros, when the data source fails.

1. Apply `supabase/migrations/202610160001_dashboard.sql`. It creates `sidequest_payouts`, `sidequest_stripe_accounts`, and the `sidequest_dashboard()` function. Users can read only their own rows. Only the service role can write them.
2. Set `SUPABASE_SECRET_KEY`, `STRIPE_CONNECT_KEY`, and `STRIPE_CONNECT_COUNTRIES` as `.env.example` describes. Enable Connect and Accounts v2 on the Stripe platform. Check that each listed country supports USD payouts.
3. Set `KOAH_SERVING_TOKEN` (and `KOAH_API_URL` outside production). The page reads daily impressions and earnings from Koah's `GET /api/v1/server/users/:user_id/earnings`, from the sign-up date to today. The user ID is the Supabase user ID that the ad proxy sends to Koah.
4. Record each payout in `sidequest_payouts` with a unique `provider_reference`. Mark it `paid` only after the provider confirms it. Failed payouts do not reduce the balance.

To see the page locally, run `bun dev`, sign in, and insert rows into `sidequest_payouts` with the local database. Earnings come from the local Koah server.

The balance is Koah earnings in cents minus paid and pending payouts. The page shows a negative balance as zero. A user can connect Stripe only when the balance is above $10.00. A balance of $10.00 stays locked and $10.01 unlocks. The server action checks the balance again and takes only the country from the browser.

The server creates an Accounts v2 recipient with an Express dashboard, then opens Stripe-hosted onboarding. It reserves an idempotency key before it creates the account. Stripe can discard idempotency keys after 24 hours. For that reason, the server replaces the key of an unfinished reservation after 23 hours, or when the user selects another country. The Stripe mode (live or test) comes from the key prefix, and each mode has its own connection per user.

Returning from Stripe does not mean the setup is complete. Each page load reads the account capabilities from Stripe. Incomplete accounts offer **Finish Stripe setup**. Active accounts offer a one-use Express login link. Before you enable live payouts, verify the Stripe account and payout webhooks in the payout service, and check the recipient capabilities before each transfer.

## Footer payout estimate

The home-page flip counter models Koah network payouts from a measured seven-day impression snapshot, a $15 CPM assumption, and a 70% payout share. It is not a ledger of payments already made. See [the data source, calculation, and refresh steps](docs/payout-estimate.md). The amount advances from Unix time at the snapshot's average pace and persists across reloads.

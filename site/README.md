# Sidequest website

A landing page for an upcoming Claude Code and Claude Desktop mod that shares ad revenue with users. Built with Next.js 16, React 19, and Tailwind CSS 4.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Keep `.env.local` out of Git. The form returns an explicit error until Loops is configured; it never pretends to store a signup.

## Loops setup

1. Add `LOOPS_API_KEY` to `.env.local`.
2. Set `LOOPS_FROM_EMAIL` to a sender local part on your verified Loops domain. The setup script defaults to `noreply`, the existing sender in the connected Koah account.
3. Run `npm run loops:setup`. It creates the two waitlist contact properties (`muxWaitlistJoinedAt`, `muxWaitlistWelcomeSent`; the keys keep their original names), creates or reuses the dedicated Sidequest welcome template, uploads `emails/waitlist-welcome.lmx`, publishes the template, and saves `LOOPS_WAITLIST_TRANSACTIONAL_ID` to `.env.local`. The script does not send email or alter unrelated templates.
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

## Checks

```bash
npm test
npm run lint
npm run build
```

The tests cover input validation, storage failures, repeat signups, email retries, provider conflicts, subscription preservation, and rate limiting. They mock Loops and send no email.

## Deployment

Add the same `LOOPS_API_KEY`, `LOOPS_WAITLIST_TRANSACTIONAL_ID`, and optional `LOOPS_WAITLIST_MAILING_LIST_ID` to the deployment's server environment. Set `NEXT_PUBLIC_SITE_URL` to the public site URL for social share images, or use Vercel's automatic production URL. Local `.env.local` values do not configure a deployed site.

The page collects waitlist signups for the unreleased mod. Ad previews show illustrative placements and earnings; actual rates and payout details will follow before launch.

## Sign-in

### Show or hide sign-in

Toggle the boolean [`sign-in-enabled` flag in Vercel](https://vercel.com/koah-14ef6421/mux-landing/flag/sign-in-enabled). Select the environment, choose **On** or **Off**, then save the change. After the code is deployed, flag changes need no redeployment. Refresh the page after changing the flag; Vercel's SDK may briefly use a cached value while the change reaches the app.

- **On:** shows the Sign in or Account link and enables Google and email sign-in.
- **Off:** hides the link, redirects `/sign-in`, `/account`, and `/auth/callback` to `/`, and blocks new sign-in requests from previously loaded forms. Signing out remains allowed. It does not delete accounts or revoke existing Supabase sessions.

The initial flag is **Off** in Production and Preview and **On** in Development. `src/lib/feature-flags.ts` uses the official Flags SDK with Vercel's OIDC credentials. Vercel supplies these credentials on deployments. For local use, pull the Development credentials with `vercel env pull` and preserve the existing local Loops settings. Without a flag value, the fallback is **Off**. This flag controls the website's sign-in feature; Supabase still enforces user authentication and data permissions.

### Google and email links

The shared header opens `/sign-in`. The Google button starts Supabase's PKCE OAuth flow. `/auth/callback` exchanges the one-use code for a cookie session and always returns to `/account`. The account page verifies the user through Supabase on the server. Signing out ends the current browser session.

The email form calls Supabase `signInWithOtp` to send a one-use sign-in link. It also creates accounts for new email addresses, without passwords. It keeps the email in the form, shows send failures, and waits 60 seconds before offering another send. Supabase enforces its own server-side rate limits. Email sign-in does not subscribe users to marketing messages.

The default Supabase email template returns to `/auth/callback` using PKCE. Open those links in the browser that requested them. A custom template can instead send `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`; the callback verifies that hash directly, which also supports opening the email in a different browser. Only the `email` verification type is accepted, and the callback always redirects to `/account`.

Before enabling email delivery for public users, configure custom SMTP in Supabase. Its default SMTP service only sends to project team members and limits email volume. For Loops, use `smtp.loops.so`, port `587`, username `loops`, and a Loops API key as the SMTP password. Configure both the **Confirm signup** and **Magic Link** email templates. Keep email confirmation enabled. See [Supabase email links](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp), and [Loops SMTP setup](https://loops.so/docs/smtp/supabase).

Run `npm run loops:auth-setup` to publish the dedicated white-background, black-text sign-in email from `emails/sign-in-link.lmx`. The script does not send email or change the waitlist email. It saves a Loops template ID locally and generates `emails/supabase-sign-in.json`. Paste that JSON into both Supabase's **Confirm signup** and **Magic Link** message bodies after configuring Loops SMTP. The payload uses a token hash and the app's allowed callback URL. Auth links disable Loops click tracking. It does not add recipients to the Loops marketing audience. SMTP credentials stay in Supabase; the Next.js app needs no additional private keys for email sign-in.

The current setup uses the [mux Supabase project](https://supabase.com/dashboard/project/oofxihxdnkqznzndwlbz) and the [mux-landing Google Cloud project](https://console.cloud.google.com/auth/clients?project=koah-mux). The Google web client is named `mux web`. Its authorized callback is `https://oofxihxdnkqznzndwlbz.supabase.co/auth/v1/callback`. Public Supabase settings are configured locally and in Vercel's Production, Preview, and Development environments. Store the Google client secret only in Supabase's Google provider settings.

1. Open the existing Supabase organization through its Vercel Marketplace installation. Create a Supabase project if the organization has none.
2. Connect that resource to the `mux-landing` Vercel project. The integration syncs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Older integrations can use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The app does not use database passwords, a secret key, or a service-role key.
3. Add only these public Supabase settings to `.env.local`, preserving the existing Loops settings. Do not commit the file.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://getsidequest.dev` and allow `https://getsidequest.dev/auth/callback`, `https://mux-landing.vercel.app/auth/callback`, and `http://localhost:3000/auth/callback`. Add `http://127.0.0.1:3000/auth/callback` only if you use that host. Keep the `mux-landing.vercel.app` callback: Preview deployments have no `NEXT_PUBLIC_SITE_URL`, so `getAuthOrigin` builds their callback from `VERCEL_PROJECT_PRODUCTION_URL`, which can still be that domain. Production sets `NEXT_PUBLIC_SITE_URL=https://getsidequest.dev`; update it and this allowlist together if the domain changes.
5. In Google Auth Platform, create a web OAuth client using the Supabase callback URL shown by **Authentication → Sign In / Providers → Google**. Enable the `openid`, email, and profile scopes. Configure the audience for the intended users.
6. Save the Google client ID and secret in the Supabase Google provider settings and enable the provider. Do not put the Google secret in Next.js public environment variables.
7. Restart the local server after changing environment variables. Sign in with a real Google account, check `/account`, reload, sign out, and confirm `/account` returns to sign-in. Repeat on the deployed site.

Sign-in and waitlist subscriptions are separate. Google sign-in creates an account but does not add a Loops contact or send marketing email. The website shows an explicit unavailable state until Supabase is configured. Cancelled or failed OAuth flows return to sign-in with safe, fixed messages. Cookies use HttpOnly and SameSite=Lax; production uses Secure cookies. Session responses are private and are not cached.

The auth tests check callback origin restrictions, public-key requirements, email validation, account creation requests, send failures, cooldowns, and configuration/error behavior. They do not replace real Google or email link tests.

## Footer payout estimate

The home-page flip counter models Koah network payouts from a measured seven-day impression snapshot, a $15 CPM assumption, and a 70% payout share. It is not a ledger of payments already made. See [the data source, calculation, and refresh steps](docs/payout-estimate.md). The amount advances from Unix time at the snapshot's average pace and persists across reloads.

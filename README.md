# mux waitlist

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
3. Run `npm run loops:setup`. It creates the two mux contact properties, creates or reuses the dedicated mux welcome template, uploads `emails/waitlist-welcome.lmx`, publishes the template, and saves `LOOPS_WAITLIST_TRANSACTIONAL_ID` to `.env.local`. The script does not send email or alter unrelated templates.
4. Optionally set `LOOPS_WAITLIST_MAILING_LIST_ID` to an existing list ID. Otherwise, select waitlist contacts in Loops with the filter **muxWaitlistJoinedAt is not empty**.
5. Submit your own email through the site to test the complete flow.

The published welcome email follows Modal's simple text layout: a small mux heading, three short paragraphs, one inline link, and a personal sign-off. It uses the site's black and white colors, thanks the reader, and links to [@guard_if on Twitter / X](https://x.com/guard_if). The sender display name is `guard_if at mux`. Loops appends its configured footer.

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

<div align="center">

```
███████╗██╗██████╗ ███████╗ ██████╗ ██╗   ██╗███████╗███████╗████████╗
██╔════╝██║██╔══██╗██╔════╝██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝
███████╗██║██║  ██║█████╗  ██║   ██║██║   ██║█████╗  ███████╗   ██║
╚════██║██║██║  ██║██╔══╝  ██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║
███████║██║██████╔╝███████╗╚██████╔╝╚██████╔╝███████╗███████║   ██║
╚══════╝╚═╝╚═════╝ ╚══════╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝
```

**A short detour under every Claude Code answer.**

One clearly labeled sponsored card, right where the answer ends.

[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-D97757?logo=claude&logoColor=white)](https://claude.com/claude-code)
[![Install](https://img.shields.io/badge/install-sidequest%40koah-1f6feb)](#install)
[![Powered by Koah](https://img.shields.io/badge/ads%20by-Koah-111111)](https://koah.ai)
[![Website](https://img.shields.io/badge/site-getsidequest.dev-000000?logo=vercel&logoColor=white)](https://getsidequest.dev)
[![Last commit](https://img.shields.io/github/last-commit/koahlabs/sidequest?color=2ea44f)](https://github.com/koahlabs/sidequest/commits/main)

[Install](#install) · [Connect](#connect) · [Configure](#configure) · [Use](#use) · [Privacy](#what-it-sends) · [Local development](#local-development)

</div>

---

## What it looks like

Claude answers as usual. When the turn ends, Sidequest adds a divider and one
ad under the last message of that answer:

```
⏺ Use a middleware file at the project root and match only the routes you
  need, so static assets skip it.

────────────────────────────────────────────────────────────────────────

[▣] Patagonia  Sponsored

Built to last, repaired for free. Patagonia's Ironclad Guarantee means...

╭────────────╮
│ Learn More │
╰────────────╯
```

- Every card says **Sponsored**. The ad never goes into Claude's answer or the
  conversation, so the model never reads it.
- Each answer gets its own ad. Earlier ads stay where they are.
- It works in the terminal and in the Claude desktop app, with the
  advertiser's icon next to its name.

## Install

Run this at the prompt of a Claude Code session:

```
/plugin install sidequest --marketplace koahlabs/sidequest
```

Answer `y` to add the marketplace, then pick a scope.

If the `koah` marketplace is already added:

```
/plugin marketplace update koah
/plugin install sidequest@koah
```

## Connect

Run this once at the prompt:

```
/sidequest-connect
```

Then:

1. Open [getsidequest.dev/connect](https://getsidequest.dev/connect) and sign in.
2. Type the code that Claude Code shows in your terminal.
3. Check the request details and confirm.

Claude Code then shows "Sidequest connected as <email>". Until you connect, the
mod requests no ads and shows a startup message that tells you to run
`/sidequest-connect`. The code expires after 10 minutes.

Never enter a code that someone else sent you. Only enter a code shown in your
own terminal.

## Configure

| Option | What it is |
| --- | --- |
| `demo` | Request Koah's fixed sample ad instead of live inventory |

## Use

| Action | How |
| --- | --- |
| Turn ads off or on for this session | `/sidequest` |
| See a sample ad | Set `demo` to `true` |
| Count an impression | Automatic, once, when the mod draws the ad under the reply |

## What it sends

Each request goes to getsidequest.dev. It carries the last question and answer
(up to 4,000 characters each), the session ID, and a random per-machine device
key. The site forwards the request to Koah with your account. The mod does no
IP lookup: the site sees your IP as any web request does. It never sends an
email address or phone number.

## Requirements

- Claude Code with mod support
- macOS for advertiser icons: they use `curl` and `sips`. Ads still render
  elsewhere, without the icon.

## Repo layout

| Folder | What it is |
| --- | --- |
| [`plugin/`](plugin) | The mod, published through the `koah` marketplace in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) |
| [`site/`](site) | The website, a Next.js app deployed on Vercel (project `sidequest-landing`, root directory `site`) |
| [`install/`](install) | A skill that walks someone through installing the mod |

## Local development

1. Install Docker (OrbStack), the Supabase CLI, and Node with npm. Check out Koah locally and run `koah-server`. Koah uses port 3000.
2. Prepare local Koah:
   - Create a publisher for Sidequest.
   - In the local publisher dashboard, open Settings → Organization → API Keys. Create a key with the Serving scope.
   - Note the publisher external ID.
   - Add at least one active ad group that targets the `cli` inventory type. CLI requests match only ad groups that opt in to `cli`, so without one every request is a no-fill.
   - To skip inventory, set the plugin option `demo` to `true`. The plugin then shows a fixed sample ad.
3. Start Supabase. This applies the migrations in `site/supabase/migrations`. `supabase db reset` applies them again and wipes local data.

   ```
   cd site
   supabase start
   ```

4. Copy `site/.env.example` to `site/.env.local`. Set these values:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`: the publishable and secret keys from `supabase status`.
   - `KOAH_API_URL=http://localhost:3000`
   - `KOAH_SERVING_TOKEN`: the Serving API key from step 2.
   - `KOAH_PUBLISHER_ID`: the publisher external ID from step 2.
   - `FLAGS`: a Vercel Flags SDK key for the Development environment. It lets the `sign-in-enabled` flag evaluate. List or create keys with `vercel flags sdk-keys ls`.
5. Start the site on port 3001, because Koah uses port 3000.

   ```
   npm install
   npm run dev -- -p 3001
   ```

6. From the repo root, start Claude Code with the plugin and the local site URL:

   ```
   claude --plugin-dir plugin --settings '{"env":{"SIDEQUEST_URL":"http://localhost:3001"}}'
   ```

   The plugin accepts this override only for `http://localhost` or `http://127.0.0.1`. It reads the override only from your own user settings or the `--settings` flag, never from a repo's settings.
7. Run `/sidequest-connect` in Claude Code. The browser opens `localhost:3001/connect`.
   - Sign in with email. Google sign-in is off locally.
   - Open the sign-in email in Mailpit at http://127.0.0.1:54324. Click the link in the same browser.
   - Type the code that Claude Code shows. Check the details and click "Connect this computer".
   - Claude Code shows "Sidequest connected as <email>".
8. Ask a question that matches your local `cli` inventory. The ad appears under the reply.
   - If no ad appears, open the queries in local Koah for the Sidequest publisher. `ad_id` 0 means no fill.
   - Local requests have no location, because they come from `::1`.

Checks:

```
claude plugin validate plugin
claude plugin test plugin
cd site && npm test && npm run lint && npm run build
```

A push to `main` deploys the site to production when it changes `site/`.

---

<div align="center">

Made by [Koah Labs](https://koah.ai)

</div>

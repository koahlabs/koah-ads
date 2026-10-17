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

[Install](#install) · [Use](#use) · [Privacy](#what-it-sends) · [Local development](#local-development)

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
  advertiser's icon next to its name when the icon loads.

## Install

Open [getsidequest.dev/account](https://getsidequest.dev/account) and sign in. The setup page shows how to install and connect Sidequest in the terminal or in Claude Desktop.

## Use

| Action                              | How                                                        |
| ----------------------------------- | ---------------------------------------------------------- |
| Turn ads off or on for this session | `/sidequest`                                               |
| Count an impression                 | Automatic, once, when the mod draws the ad under the reply |

## What it sends

Each request goes to getsidequest.dev. It carries the last question and answer (up to 4,000 characters each), the session ID, and a random per-machine device key. The site forwards the request to Koah with your account. The mod does no IP lookup: the site sees your IP as any web request does. It never sends an email address or phone number.

## Requirements

- Claude Code 2.1.292 or later in the terminal. `claude plugin install --marketplace` first shipped in 2.1.292.
- Claude Desktop with bundled Claude Code 2.1.287 or later. Mods first shipped in 2.1.287. Run `/status` in a local Code session to see that version. It can differ from `claude --version`.
- Advertiser icons need `curl`. Icons that are not PNG also need `sips`, which macOS includes. Ads show without an icon when it fails to load.

## Troubleshooting

- **No ad appears.** Some requests return no ad. Ask another question.
- **Claude asks you to run `/sidequest-connect`, or the status line shows `sidequest: not connected`.** Run `/sidequest-connect`.
- **The plugin does not load.** Start a new session, or run `/reload-plugins`.
- **`claude: command not found`.** Install the CLI with the [official setup guide](https://code.claude.com/docs/en/setup).

## Update and uninstall

Run these commands in a terminal. After an update, start a new session.

```
claude plugin update sidequest@koah
claude plugin uninstall sidequest@koah
claude plugin marketplace remove koah
```

The last command is optional. It removes the marketplace.

## Repo layout

| Folder              | What it is                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`plugin/`](plugin) | The mod, published through the `koah` marketplace in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) |
| [`site/`](site)     | The website, a Next.js app. See [Deployment](site/README.md#deployment).                                                  |

## Local development

1. Install Docker (OrbStack), the Supabase CLI, and Bun. Check out Koah locally and run `koah-server`. Koah uses port 3000.
2. Prepare local Koah:
   - Create a publisher for Sidequest.
   - In the local publisher dashboard, open Settings → Organization → API Keys. Create a key with the Serving scope.
   - Note the publisher external ID.
   - Add at least one active ad group that targets the `cli` inventory type. CLI requests match only ad groups that opt in to `cli`, so without one every request is a no-fill.
3. Run `bun dev` from the repo root. It does these steps:
   - It installs packages and the git hooks that format and lint staged files before each commit.
   - It starts Supabase and the Mailpit mail server, and applies the migrations in `site/supabase/migrations`.
   - It creates `site/.env.local` if it does not exist, and writes the local Supabase and Koah URLs and keys to it.
   - It starts the site on port 3001, because Koah uses port 3000.

   Ctrl-C stops the site and Supabase. Local data stays. `bun dev --reset` wipes local data and applies the migrations again.

4. In `site/.env.local`, set the values that the script cannot know. The script shows a warning for each value that is not set.
   - `KOAH_SERVING_TOKEN`: the Serving API key from step 2.
   - `KOAH_PUBLISHER_ID`: the publisher external ID from step 2.
   - `FLAGS`: a Vercel Flags SDK key for the Development environment. It lets the `sign-in-enabled` flag evaluate. List or create keys with `vercel flags sdk-keys ls`.
5. From the repo root, start Claude Code with the plugin and the local site URL:

   ```
   claude --plugin-dir plugin --settings '{"env":{"SIDEQUEST_URL":"http://localhost:3001"}}'
   ```

   The setup wizard's `claude /sidequest-connect` has no `--settings` flag. It targets production unless `SIDEQUEST_URL` is set under `env` in `~/.claude/settings.json`.

   The plugin accepts this override only for `http://localhost` or `http://127.0.0.1`. It reads the override only from your own user settings or the `--settings` flag, never from a repo's settings.

6. Run `/sidequest-connect` in that session. The browser opens `localhost:3001/connect`.
   - To test from scratch, quit Claude Code and run `bun run reset`. It deletes every local account with its devices and usage, and the plugin's saved device key, in a few seconds.
   - Sign in with email. Google sign-in is off locally.
   - Open the sign-in email in Mailpit, at the URL that `bun dev` prints, and click the link.
   - Type the code that Claude Code shows. Check the details and click "Connect this computer".
   - Claude Code shows "Sidequest connected as <email>".
7. Ask a question that matches your local `cli` inventory. The ad appears under the reply.
   - If no ad appears, open the queries in local Koah for the Sidequest publisher. `ad_id` 0 means no fill.
   - Local requests have no location, because they come from `::1`.

`bun run uninstall-plugin` runs the uninstall and the marketplace remove.

## Checks

```
claude plugin validate plugin
claude plugin test plugin
bun run lint
cd site && bun run test && bun run build
```

---

<div align="center">

Made by [Koah Labs](https://koah.ai)

</div>

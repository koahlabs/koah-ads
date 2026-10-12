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
[![Website](https://img.shields.io/badge/site-Vercel-000000?logo=vercel&logoColor=white)](https://mux-landing.vercel.app)
[![Last commit](https://img.shields.io/github/last-commit/koahlabs/sidequest?color=2ea44f)](https://github.com/koahlabs/sidequest/commits/main)

[Install](#install) · [Configure](#configure) · [Use](#use) · [Privacy](#what-it-sends) · [Develop](#develop)

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

Answer `y` to add the marketplace, then pick a scope. The install screen asks
for the options below.

If the `koah` marketplace is already added:

```
/plugin marketplace update koah
/plugin install sidequest@koah
```

## Configure

| Option | Fallback env var | What it is |
| --- | --- | --- |
| `servingToken` | `KOAH_SERVING_TOKEN` | Publisher API key with the Serving scope |
| `publisherId` | `KOAH_PUBLISHER_ID` | Publisher external ID, from Settings → App in the publisher dashboard |
| `demo` | — | Request Koah's fixed sample ad instead of live inventory |

Without a token and publisher ID the mod requests nothing.

## Use

| Action | How |
| --- | --- |
| Turn ads off or on for this session | `/sidequest` |
| See a sample ad | Set `demo` to `true` |
| Count an impression | Automatic, once, when the ad is on screen |

## What it sends

Each request carries the last question and answer (up to 4,000 characters
each), the session ID, your public IP (looked up via api.ipify.org, for geo
targeting), and a random per-machine user ID. It never sends an email address or
phone number.

## Requirements

- Claude Code with mod support
- macOS for advertiser icons: they use `curl` and `sips`. Ads still render
  elsewhere, without the icon.

## Repo layout

| Folder | What it is |
| --- | --- |
| [`plugin/`](plugin) | The mod, published through the `koah` marketplace in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) |
| [`site/`](site) | The website, a Next.js app deployed on Vercel (project `mux-landing`, root directory `site`) |
| [`install/`](install) | A skill that walks someone through installing the mod |

## Develop

The mod:

```
claude plugin validate plugin
claude plugin test plugin
claude --plugin-dir plugin
```

The site (see [`site/README.md`](site/README.md)):

```
cd site
npm ci
npm run dev
```

A push to `main` deploys the site to production when it changes `site/`.

---

<div align="center">

Made by [Koah Labs](https://koah.ai)

</div>

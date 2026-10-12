# Sidequest

A Claude Code mod that shows a sponsored [Koah](https://koah.ai) ad under each
answer. It serves ads through the Koah S2S API as a CLI publisher.

| Folder | What it is |
| --- | --- |
| `plugin/` | The mod, published through the `koah` marketplace in `.claude-plugin/marketplace.json` |
| `site/` | The website, a Next.js app deployed on Vercel (project `mux-landing`, root directory `site`) |
| `install/` | A skill that walks someone through installing the mod |

## Install

Run this at the prompt of a Claude Code terminal session:

```
/plugin install sidequest --marketplace koahlabs/sidequest
```

Answer `y` to add the marketplace, then pick a scope. The install screen asks
for the options below.

## Configure

| Option | Fallback env var | What it is |
| --- | --- | --- |
| `servingToken` | `KOAH_SERVING_TOKEN` | Publisher API key with the Serving scope |
| `publisherId` | `KOAH_PUBLISHER_ID` | Publisher external ID, from Settings → App in the publisher dashboard |
| `demo` | — | Request Koah's fixed sample ad instead of live inventory |

Without a token and publisher ID the mod requests nothing.

## Use

- `/sidequest` turns ads on or off for the current session.
- Each answer gets its own ad, under its last message. Earlier ads stay where they are.
- An impression is reported once, when the ad is on screen.

## What it sends

Each request carries the last question and answer (up to 4,000 characters
each), the session ID, your public IP (looked up via api.ipify.org, for geo
targeting), and a random per-machine user ID. It never sends an email address or
phone number.

## Requirements

Advertiser icons use `curl` and `sips`, so they show on macOS only. Ads still
render elsewhere, without the icon.

## Develop

The mod:

```
claude plugin validate plugin
claude plugin test plugin
claude --plugin-dir plugin
```

The site (see `site/README.md`):

```
cd site
npm ci
npm run dev
```

A push to `main` deploys the site to production when it changes `site/`.

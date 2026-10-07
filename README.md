# koah-ads

A Claude Code mod that shows a sponsored [Koah](https://koah.ai) ad above the
prompt after each answer. It serves ads through the Koah S2S API as a CLI
publisher.

## Install

Run this at the prompt of a Claude Code terminal session:

```
/plugin install koah-ads --marketplace koahlabs/koah-ads
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

- `/koah-ads` turns ads on or off for the current session.
- The ad stays up until Koah serves the next one.
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

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

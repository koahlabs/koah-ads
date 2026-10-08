---
name: koah-ads-install
description: Installs, configures, updates, or removes the koah-ads Claude Code plugin, which shows a sponsored Koah ad above the prompt after each answer. Use when the user says "install koah-ads", "set up Koah ads in Claude Code", "add my Koah serving token", "update koah-ads", "turn off / uninstall koah-ads", or when koah-ads shows "no credentials".
---

# Install koah-ads

koah-ads is a Claude Code plugin published from the GitHub marketplace
`koahlabs/koah-ads`. After each answer it shows one labeled sponsored ad above
the prompt, served by the Koah S2S API with the user's own publisher
credentials. The publisher earns the ad revenue.

## Before installing, tell the user what it sends

Each ad request sends to `app.koah.ai`: the last prompt and answer (up to
4,000 characters each), the session ID, the public IP (looked up through
`api.ipify.org`, for geo targeting), and a random per-machine user ID. Get a
yes before going on. Do not install it silently.

## 1. Check Claude Code

Run `claude --version`. The one-line `/plugin install ... --marketplace` form
needs 2.1.275 or later; the two-command form in step 2 works on any version
with plugin support. Run `claude plugin list` and look for `koah-ads`. If it is
already installed, skip to step 3.

## 2. Install

**Interactive terminal session (preferred).** Claude cannot type slash
commands, so ask the user to type this at the prompt:

```
/plugin install koah-ads --marketplace koahlabs/koah-ads
```

They answer `y` to add the marketplace, press Enter for user scope, and fill in
the options screen (step 3). The plugin runs at once.

**Anywhere else (desktop Code tab, IDE, or the user prefers you do it).** Run:

```bash
claude plugin marketplace add koahlabs/koah-ads
claude plugin install koah-ads@koah --scope user
```

## 3. Credentials

The plugin needs two values from the Koah publisher dashboard at
https://app.koah.ai:

| Option | Env var fallback | What it is |
| --- | --- | --- |
| `servingToken` | `KOAH_SERVING_TOKEN` | Publisher API key with the **Serving** scope |
| `publisherId` | `KOAH_PUBLISHER_ID` | Publisher external ID, under Settings → App |
| `demo` | none | `true` serves Koah's fixed sample ad instead of live inventory |

No publisher account yet: send the user to https://app.koah.ai to sign up.
Without both values the plugin requests nothing and shows a dim
"no credentials" line.

The serving token is a secret. Have the user enter it themselves, by one of:

- the options screen in the `/plugin install` flow, or
- their own terminal:

  ```bash
  claude plugin configure koah-ads --values-stdin
  ```

  then paste `{"servingToken":"…","publisherId":"…"}`, press Enter, then Ctrl-D.

If the user pastes the token into chat anyway, pipe it to
`claude plugin configure koah-ads --values-stdin` without echoing it back,
writing it to a file, or putting it on a command line that lands in shell
history (use a heredoc). Never commit it.

Check with `claude plugin configure koah-ads`: it lists unset options. A token
must not appear in its output or in your reply.

## 4. Verify

1. `claude plugin list` shows `koah-ads@koah` as enabled.
2. Ask the user to start a new session (a CLI install does not load into the
   running one), ask any question, and look above the prompt after the answer:
   an advertiser name, `Sponsored`, a call-to-action link, and the ad text.
3. No ad: run `claude --debug` and look for lines starting `koah-ads:`. A
   status line `koah-ads: request_ad 401` or `403` means a wrong token or a
   token without the Serving scope. A `204` from Koah means no ad filled; that
   is normal and shows nothing. Setting `demo` to `true` confirms the wiring.

Advertiser icons need `curl` and `sips`, so they show on macOS only. The ad
itself shows everywhere.

## Daily use

- `/koah-ads` turns ads on or off for the current session.
- Update: `claude plugin marketplace update koah`, then start a new session.
- Remove: `claude plugin uninstall koah-ads@koah`, and optionally
  `claude plugin marketplace remove koah`.

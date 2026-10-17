---
name: sidequest-install
description: Installs, configures, updates, or removes the sidequest Claude Code plugin, which shows a sponsored Koah ad under each answer. Use when the user says "install sidequest", "set up Koah ads in Claude Code", "connect sidequest", "update sidequest", "turn off / uninstall sidequest", or when sidequest shows "run /sidequest-connect".
---

# Install Sidequest

Sidequest is a Claude Code plugin published from the GitHub marketplace
`koahlabs/sidequest`. Under each answer it shows one labeled sponsored ad,
served through getsidequest.dev, which requests it from Koah for the user's
account.

## Before installing, tell the user what it sends

Each ad request sends to `getsidequest.dev`: the last prompt and answer (up to
4,000 characters each), the session ID, and a random per-machine device key.
The site forwards the request to Koah with the user's account. The mod looks up
no IP; the site sees it as any web request does. Get a yes before going on.
Do not install it silently.

## 1. Check Claude Code

Sidequest needs mod support. See the
[requirements](../../README.md#requirements) for the minimum versions. For
Claude Desktop, follow [`../../docs/claude-desktop.md`](../../docs/claude-desktop.md).
The desktop app and the CLI can have different versions.

Run `claude --version`. The in-session `/plugin install ... --marketplace` form
needs 2.1.275 or later. The shell `claude plugin install ... --marketplace` form
needs 2.1.292 or later. Run `claude plugin list` and look for `sidequest`. If it is
already installed, skip to step 3.

## 2. Install

**Interactive terminal session (preferred).** Claude cannot type slash
commands, so ask the user to type this at the prompt:

```
/plugin install sidequest --marketplace koahlabs/sidequest
```

They answer `y` to add the marketplace and press Enter for user scope. The
plugin runs at once.

**Anywhere else (desktop Code tab, IDE, or the user prefers you do it).** Run:

```bash
claude plugin install sidequest --marketplace koahlabs/sidequest
```

## 3. Connect

Ask the user to type this at the prompt:

```
/sidequest-connect
```

Then the user:

1. Opens getsidequest.dev/connect and signs in.
2. Types the code that Claude Code shows in the terminal.
3. Checks the request details and confirms.

Claude Code then shows "Sidequest connected as <email>". Until then the plugin
sends no ad requests and shows a startup message: "run /sidequest-connect".

Warn the user: never enter a code that someone else sent. Only enter a code
shown in their own terminal.

## 4. Verify

1. `claude plugin list` shows `sidequest@koah` as enabled.
2. Ask the user to start a new session (a CLI install does not load into the
   running one), ask any question, and look under the answer:
   an advertiser name, `Sponsored`, a call-to-action link, and the ad text.
3. No ad: if the plugin shows `sidequest: not connected`, the account is not
   linked. Run `/sidequest-connect` again. A request with no fill shows nothing;
   that is normal.

Advertiser icons need `curl` and `sips`, so they show on macOS only. The ad
itself shows everywhere.

## Daily use

- `/sidequest` turns ads on or off for the current session.
- Update: `claude plugin marketplace update koah`, then start a new session.
- Remove: `claude plugin uninstall sidequest@koah`, and optionally
  `claude plugin marketplace remove koah`.

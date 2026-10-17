# Install Sidequest in Claude Desktop

Sidequest shows sponsored ads below answers in the **Code** tab of Claude Desktop. Use a **local session** on your computer.

## Check the app version

1. Open Claude Desktop and select **Code**.
2. Start a local session in a folder on your computer.
3. Enter `/status`.
4. Check the **Claude Code** version against the [requirements](../README.md#requirements).
5. Update Claude Desktop if its bundled Claude Code version is older. The desktop app has its own Claude Code version; `claude --version` in a terminal checks the separate CLI version.

## Install through the desktop app

The setup page at getsidequest.dev has an **Open in Claude Desktop** link. It opens a new session with a message that asks Claude to run the install command. Press Enter and allow the command.

To install by hand:

1. In the **Code** tab, send `/plugin` to open the Plugins page.
2. Click **Add → Add marketplace → Add from a repository**, paste `https://github.com/koahlabs/sidequest` into the **URL** box, and click **Sync**.
3. Under **Discover**, find **Sidequest** and click **+**.
4. Under **Yours**, check that Sidequest is enabled.

## Install from a terminal

Run these commands in your computer's terminal, outside a Claude conversation:

```bash
claude plugin install sidequest --marketplace koahlabs/sidequest
claude plugin list
```

Check that `sidequest@koah` appears as enabled. Open a new local session in Claude Desktop's **Code** tab. Local desktop sessions and the CLI share the user plugin settings on the same computer.

If the terminal reports `claude: command not found`, follow the [official Claude Code CLI installation guide](https://code.claude.com/docs/en/setup) before using this fallback.

## Connect and verify

In the same session, run `/sidequest-connect`. You do not need to reload the session. Follow the [connect steps](../README.md#connect). Until you connect, Sidequest requests no ads.

Ask Claude a question and look below the answer for a card marked **Sponsored**. A request with no ad is normal. See [what it sends](../README.md#what-it-sends).

## If installation or loading fails

- Select an install scope to finish the install. Opening the plugin details screen alone does not install it.
- Start a new local Code session after a terminal install.
- Check `/status` in the desktop session, not only `claude --version` in the terminal.
- Share the install error and the desktop session's Claude Code version when asking for help.

## Official documentation

- [Install plugins in Claude Desktop](https://code.claude.com/docs/en/desktop#install-plugins)
- [Install and manage plugins](https://code.claude.com/docs/en/discover-plugins)
- [Mod support, versions, and supported surfaces](https://code.claude.com/docs/en/plugins/mods/overview)

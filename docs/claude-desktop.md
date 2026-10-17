# Install Sidequest in Claude Desktop

Sidequest shows sponsored ads below answers in the **Code** tab of Claude Desktop. Use a **local session** on your computer.

## Check the app version

1. Open Claude Desktop and select **Code**.
2. Start a local session in a folder on your computer.
3. Enter `/status`.
4. Check the **Claude Code** version against the [requirements](../README.md#requirements).
5. Update Claude Desktop if its bundled Claude Code version is older. The desktop app has its own Claude Code version; `claude --version` in a terminal checks the separate CLI version.

## Install through the desktop app

1. Open **Settings → Plugins**.
2. Click **Add → Add marketplace → Add from a repository** and enter `koahlabs/sidequest`.
3. Under **Discover**, find **Sidequest** and click **+**.
4. Under **Yours**, check that Sidequest is enabled.

## Add the marketplace or finish installation from a terminal

Run these commands in your computer's terminal, outside a Claude conversation:

```bash
claude plugin marketplace add koahlabs/sidequest
claude plugin install sidequest@koah --scope user
claude plugin list
```

Check that `sidequest@koah` appears as enabled. Open a new local session in Claude Desktop's **Code** tab. Local desktop sessions and the CLI share the user plugin settings on the same computer.

If the terminal reports `claude: command not found`, follow the [official Claude Code CLI installation guide](https://code.claude.com/docs/en/setup) before using this fallback.

## Connect and verify

Start a local Code session and send any message first; Sidequest loads when the session starts. Then run `/sidequest-connect` and follow the [connect steps](../README.md#connect). Until you connect, Sidequest requests no ads.

Ask Claude a question and look below the answer for a card marked **Sponsored**. Enable the `demo` option to see a sample ad; live inventory can return no ad. See [what it sends](../README.md#what-it-sends).

## If installation or loading fails

- Select an install scope to finish the install. Opening the plugin details screen alone does not install it.
- Start a new local Code session after a terminal install.
- Check `/status` in the desktop session, not only `claude --version` in the terminal.
- Share the install error and the desktop session's Claude Code version when asking for help.

## Official documentation

- [Install plugins in Claude Desktop](https://code.claude.com/docs/en/desktop#install-plugins)
- [Install and manage plugins](https://code.claude.com/docs/en/discover-plugins)
- [Mod support, versions, and supported surfaces](https://code.claude.com/docs/en/plugins/mods/overview)

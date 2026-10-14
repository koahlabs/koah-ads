# Install Sidequest in Claude Desktop

Sidequest shows sponsored ads below answers in the **Code** tab of Claude Desktop. Use a **local session** on your computer.

## Check the app version

1. Open Claude Desktop and select **Code**.
2. Start a local session in a folder on your computer.
3. Enter `/status`.
4. Check the **Claude Code** version. Desktop mods require **2.1.286 or later**.
5. Update Claude Desktop if its bundled Claude Code version is older. The desktop app has its own Claude Code version; `claude --version` in a terminal checks the separate CLI version.

## Install through the desktop app

1. Click **+** beside the prompt box.
2. Select **Plugins → Add plugin**.
3. Find and select **sidequest**.
4. Choose **user scope** to install it for your account on this computer.
5. Open **+ → Plugins → Manage plugins** and check that Sidequest is enabled.

The plugin browser lists plugins from the marketplaces already configured on your computer. If Sidequest does not appear, register the Koah marketplace with the terminal steps below.

## Add the marketplace or finish installation from a terminal

Run these commands in your computer's terminal, outside a Claude conversation:

```bash
claude plugin marketplace add koahlabs/sidequest
claude plugin install sidequest@koah --scope user
claude plugin list
```

Check that `sidequest@koah` appears as enabled. Open a new local session in Claude Desktop's **Code** tab. Local desktop sessions and the CLI share the user plugin settings on the same computer.

If the terminal reports `claude: command not found`, follow the [official Claude Code CLI installation guide](https://code.claude.com/docs/en/setup) before using this fallback.

## Configure and verify

Sidequest needs your **Koah serving token** and **publisher external ID** from the Koah publisher dashboard. Enter those values through the plugin's options screen. Keep the serving token private. See [Sidequest's configuration guide](../README.md#configure) for the fields and environment variable fallbacks.

Without both values, Sidequest requests no ads. With valid values, ask Claude a question and look below the answer for a card marked **Sponsored**. Enable the `demo` option to request a sample ad; live inventory can return no ad.

Each ad request sends the last question and answer (up to 4,000 characters each), the session ID, your public IP, and a random machine ID to Koah. Sidequest uses `api.ipify.org` to look up the public IP.

## If installation or loading fails

- Select an install scope to finish the install. Opening the plugin details screen alone does not install it.
- Start a new local Code session after a terminal install.
- Check `/status` in the desktop session, not only `claude --version` in the terminal.
- Share the install error and the desktop session's Claude Code version when asking for help. Do not share the serving token.

## Official documentation

- [Install plugins in Claude Desktop](https://code.claude.com/docs/en/desktop#install-plugins)
- [Install and manage plugins](https://code.claude.com/docs/en/discover-plugins)
- [Mod support, versions, and supported surfaces](https://code.claude.com/docs/en/plugins/mods/overview)

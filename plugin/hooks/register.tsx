import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { AdSlot, KoahAd } from "../types";

const MAX_TEXT = 4000;
const MAX_SLOTS = 50;
const SITE = "https://getsidequest.dev";
const POLL_MS = 1000;

const slots = atom({ plugin: "sidequest", key: "slots" } as const, [] as AdSlot[]);
const isOff = atom({ plugin: "sidequest", key: "isOff" } as const, false);

type Options = { demo?: boolean };
type Pending = { key: string; expiresAt: number };

let opts: Options = {};
let siteOnce: Promise<string> | undefined;
let question = "";
// Impression ids already reported this load; Koah dedupes impressions per served ad.
const reported = new Set<string>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function storedDeviceKey($: EngineInterface): Promise<string | undefined> {
  const saved = await $.store.get("deviceKey");
  return typeof saved === "string" ? saved : undefined;
}

async function storedPending($: EngineInterface): Promise<Pending | undefined> {
  const saved = (await $.store.get("pending")) as Partial<Pending> | undefined;
  return typeof saved?.key === "string" && typeof saved.expiresAt === "number"
    ? (saved as Pending)
    : undefined;
}

function site($: EngineInterface): Promise<string> {
  return (siteOnce ??= resolveSite($));
}

// The person launching Claude Code sets user settings and --settings; a repo cannot. Only a loopback URL is accepted, and --settings wins.
async function resolveSite($: EngineInterface): Promise<string> {
  for (const source of ["flag", "user"] as const) {
    try {
      const { env } = await $.settings.read({ source });
      const url = new URL((env as Record<string, string> | undefined)?.SIDEQUEST_URL ?? "");
      if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
        return url.origin;
    } catch {}
  }
  return SITE;
}

// Tries the opener for each OS in turn. The reply always shows the URL, so every failure is ignored.
async function openBrowser($: EngineInterface, url: string) {
  const openers = [
    ["open", url],
    ["xdg-open", url],
    ["rundll32", "url.dll,FileProtocolHandler", url],
  ];
  for (const argv of openers) {
    try {
      if ((await $.process.run(argv)).exitCode === 0) return;
    } catch {}
  }
}

function newDeviceKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes));
  return `sq_${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

// Polls until the site confirms the pending key, refuses it, or it expires.
// A newer /sidequest-connect replaces the stored key, which ends this poll.
async function pollConnection($: EngineInterface, { key, expiresAt }: Pending) {
  const base = await site($);
  const finish = async (toast: string) => {
    await $.store.delete("pending");
    $.ui.toast(toast);
  };

  while ((await $.clock.now()) < expiresAt) {
    await $.clock.sleep(POLL_MS);
    const res = await $.http
      .fetch(`${base}/api/device`, { headers: { Authorization: `Bearer ${key}` } })
      .catch(() => undefined);
    if ((await storedPending($))?.key !== key) return;
    if (res?.status === 200) {
      const { email } = JSON.parse(res.text) as { email: string };
      await $.store.set("deviceKey", key);
      return finish(`Sidequest connected as ${email}.`);
    }
    if (res?.status === 403) return finish("Sidequest: this account is suspended.");
    if (res?.status === 404) break;
  }
  if ((await storedPending($))?.key === key) {
    await finish("Sidequest: the code expired. Run /sidequest-connect again.");
  }
}

// $.http.fetch returns text only, so curl fetches the icon and base64 encodes
// it. Many advertisers serve an ICO (Baseten does), so sips converts any
// non-PNG to a 64px PNG first.
const FETCH_ICON = `
t=$(mktemp -d) || exit 1
trap 'rm -rf "$t"' EXIT
curl -sfL --max-time 5 "$1" -o "$t/icon" || exit 1
if ! head -c 8 "$t/icon" | grep -q PNG; then
  sips -s format png -Z 64 "$t/icon" --out "$t/icon.png" >/dev/null 2>&1 || exit 1
  mv "$t/icon.png" "$t/icon"
fi
base64 < "$t/icon"
`;

const icons = new Map<string, string | undefined>();
async function favicon(
  $: EngineInterface,
  advertiser: KoahAd["advertiser"],
): Promise<string | undefined> {
  const url =
    advertiser.iconUrl ||
    (advertiser.rootDomain ? `https://${advertiser.rootDomain}/favicon.ico` : null);
  if (!url) return undefined;
  if (icons.has(url)) return icons.get(url);
  const { exitCode, stdout } = await $.process.run(["/bin/sh", "-c", FETCH_ICON, "sh", url]);
  const png = stdout.replace(/\s/g, "");
  // Keep PNGs only: a bad image makes the engine refuse the whole tree.
  const icon = exitCode === 0 && png.startsWith("iVBORw0KGgo") ? png : undefined;
  icons.set(url, icon);
  return icon;
}

async function reportImpression(
  $: EngineInterface,
  base: string,
  impressionId: string,
  key: string,
) {
  if (reported.has(impressionId)) return;
  reported.add(impressionId);
  const url = `${base}/api/impression/${impressionId}`;
  for (const wait of [0, 1000, 4000, 15000]) {
    if (wait) await $.clock.sleep(wait);
    const res = await $.http.fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return;
    // Permanent errors stop; 429 and 5xx back off and reuse the same URL.
    if (res.status !== 429 && res.status < 500) return;
  }
}

// $.state outlives a reload, so a slot can hold an ad from an older shape.
// The mod builds the impression URL from the id, so the device key goes only to this site.
function isAd(ad: unknown): ad is KoahAd {
  const a = ad as Partial<KoahAd> | null;
  return (
    typeof a?.adText === "string" &&
    typeof a.adCta === "string" &&
    typeof a.adLink === "string" &&
    typeof a.impressionId === "string" &&
    UUID.test(a.impressionId) &&
    typeof a.advertiser?.name === "string"
  );
}

export const register: Register = (on, options) => {
  opts = options as Options;
  siteOnce = undefined;

  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "sidequest",
      description: "Turn Koah sponsored ads on or off for this session",
    });
    await $.command.register({
      name: "sidequest-connect",
      description: "Link Sidequest to your account in the browser",
    });
    const pending = await storedPending($);
    if (pending) void pollConnection($, pending).catch(() => {});
    else if (!(await storedDeviceKey($))) {
      $.ui.toast("sidequest: run /sidequest-connect to link your account");
    }
    return next(e);
  });

  on("command.run", { command: "sidequest" }, async ($) => {
    const off = !(await read($, isOff));
    await update($, isOff, () => off);
    return { text: off ? "Koah ads off." : "Koah ads on." };
  });

  on("command.run", { command: "sidequest-connect" }, async ($) => {
    const base = await site($);
    const key = newDeviceKey();
    const res = await $.http
      .fetch(`${base}/api/device`, { method: "POST", headers: { Authorization: `Bearer ${key}` } })
      .catch(() => undefined);
    if (res?.status === 429) {
      return { text: "Too many connection attempts from this network. Try again in 10 minutes." };
    }
    if (res?.status !== 201)
      return { text: "Sidequest could not start a connection. Try again later." };

    const { userCode, expiresAt } = JSON.parse(res.text) as { userCode: string; expiresAt: string };
    const pending = { key, expiresAt: Date.parse(expiresAt) };
    await $.store.set("pending", pending);
    await openBrowser($, `${base}/connect`);
    void pollConnection($, pending).catch(() => {});
    return {
      text: `Open ${base}/connect and enter code **${userCode}**. Never enter a code you didn't get from this terminal.`,
    };
  });

  on("prompt.submit", async ($, e, next) => {
    question = e.text;
    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (e.agentId !== undefined || e.reason !== "answer" || !e.answer.trim()) return result;
    if (await read($, isOff)) return result;
    const key = await storedDeviceKey($);
    if (!key || !question.trim()) return result;

    const res = await $.http.fetch(`${await site($)}/api/ad`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question.slice(0, MAX_TEXT),
        answer: e.answer.slice(0, MAX_TEXT),
        conversationId: (await $.session.id()).slice(0, 64),
        demo: opts.demo ?? false,
      }),
    });

    if (res.status === 200) {
      const served = JSON.parse(res.text) as KoahAd;
      served.iconPng = await favicon($, served.advertiser);
      const slot: AdSlot = { answer: e.answer.trim(), ad: served };
      await update($, slots, (list) => [...(list ?? []), slot].slice(-MAX_SLOTS));
    } else if (res.status === 401) {
      $.ui.status("sidequest: not connected — run /sidequest-connect");
    } else if (res.status === 403) {
      $.ui.status("sidequest: account suspended");
    } else if (res.status !== 204) {
      $.ui.status(`sidequest: ad request ${res.status}`);
    }
    return result;
  });

  // The ad sits under the last message of the reply it was served for.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    if (await read($, isOff)) return next(e);
    const text = e.props.text.trim();
    const list = await read($, slots);
    const slot = text === "" ? undefined : list.find((s) => s.answer.endsWith(text));
    if (slot === undefined || !isAd(slot.ad)) return next(e);

    const { ad } = slot;
    const { Box, Text, Link, Markdown } = $.ui.resolve(e);

    // The ad is on screen now: that is the CLI impression event.
    if (!reported.has(ad.impressionId)) {
      const key = await storedDeviceKey($);
      if (key) void reportImpression($, await site($), ad.impressionId, key);
    }

    let icon = null;
    if (ad.iconPng && e.surface === "terminal") {
      const { Image } = $.ui.resolve(e);
      icon = <Image source={{ png: ad.iconPng }} columns={2} rows={1} alt=" " />;
    } else if (ad.iconPng && e.surface === "desktop") {
      // The PNG inside an Svg, in a box of fixed size (2 cells by 1): in a row an
      // Svg with no sized box collapses. The desktop draws nothing for an Svg
      // whose alt is blank, so it carries the advertiser's name.
      const { Svg } = $.ui.resolve(e);
      const source =
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        `<image href="data:image/png;base64,${ad.iconPng}" width="64" height="64"/></svg>`;
      icon = (
        <Box width={2} height={1} flexShrink={0}>
          <Svg source={source} width={16} height={16} alt={`${ad.advertiser.name} logo`} />
        </Box>
      );
    }

    // Box has no top-only border. The terminal gets a rule sized to fit (a cut
    // Text ends in an ellipsis); the remote surfaces draw a markdown rule.
    const divider =
      e.surface === "terminal" ? (
        <Text dimColor>{"─".repeat(Math.max((e.viewport?.columns ?? 64) - 4, 8))}</Text>
      ) : (
        <Markdown text="---" />
      );

    // The reply, a divider, then the ad: advertiser line, the ad text wrapped,
    // and the CTA as a bordered link. No side padding, one gap between rows;
    // rows stretch to the full width and only the button keeps its own.
    return (
      <Box flexDirection="column" width="100%">
        <Markdown text={e.props.text} />
        <Box flexDirection="column" width="100%" marginTop={1}>
          {divider}
        </Box>
        <Box flexDirection="column" width="100%" gap={1} marginTop={1}>
          <Box flexDirection="row" gap={1}>
            {icon}
            <Text bold>{ad.advertiser.name}</Text>
            <Text dimColor>Sponsored</Text>
          </Box>
          <Text wrap="wrap">{ad.adText}</Text>
          <Box alignSelf="flex-start" borderStyle="round" borderDimColor paddingX={1}>
            <Text>
              <Link href={ad.adLink}>{ad.adCta}</Link>
            </Text>
          </Box>
        </Box>
      </Box>
    );
  });
};

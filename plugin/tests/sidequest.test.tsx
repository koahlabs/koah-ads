import { expect, mock, test } from "claude-code/testing";
import type { On } from "claude-code";

const AD = {
  adText: "Find your next pair of running shoes.",
  adCta: "Explore",
  adLink: "https://app.koah.ai/kclk/648dd783-4b6f-4efa-b8a4-f7a95ccfce47",
  advertiser: {
    name: "Example Brand",
    rootDomain: "example.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=example.com&sz=64",
  },
  impressionId: "648dd783-4b6f-4efa-b8a4-f7a95ccfce47",
};

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
const OPTIONS = { demo: true };
const SITE = "https://getsidequest.dev";
const IMPRESSION_URL = `${SITE}/api/impression/${AD.impressionId}`;
const QUESTION = "What should I look for in running shoes?";
const ANSWER = "Look at fit first.\n\nPrioritize fit and cushioning.";

type Call = { url: string; method?: string; body?: string; auth?: string };

type WorldOptions = {
  store?: Record<string, unknown>;
  projectEnv?: Record<string, string>;
  userEnv?: Record<string, string>;
  flagEnv?: Record<string, string>;
  polls?: number[];
  adStatus?: number;
  ad?: typeof AD;
  failingCommands?: string[];
};

// The world beneath the mod: the site proxy, the icon fetch, and an engine
// drawing of its own for any message the mod leaves alone. `polls` are the
// statuses GET /api/device answers in turn (202 once they run out).
function world(
  on: On,
  {
    store,
    projectEnv = {},
    userEnv = {},
    flagEnv = {},
    polls = [],
    adStatus = 200,
    ad = AD,
    failingCommands = [],
  }: WorldOptions = {},
) {
  const calls: Call[] = [];
  const toasts: string[] = [];
  const statuses: (string | undefined)[] = [];
  const opened: (readonly string[])[] = [];
  const answers: Record<number, string> = {
    200: JSON.stringify({ email: "ada@example.com" }),
    202: "{}",
    404: "{}",
  };

  on("http.fetch", async (_$, e) => {
    const method = e.init?.method ?? "GET";
    calls.push({ url: e.url, method, body: e.init?.body, auth: e.init?.headers?.Authorization });
    const reply = (status: number, text = "") => ({
      value: { status, ok: status < 300, headers: {}, text },
    });
    if (e.url.endsWith("/api/device")) {
      if (method === "POST") {
        return reply(
          201,
          JSON.stringify({ userCode: "BCDF-GHJK", expiresAt: new Date(600000).toISOString() }),
        );
      }
      const status = polls.shift() ?? 202;
      return reply(status, answers[status]);
    }
    if (e.url === `${SITE}/api/ad`)
      return reply(adStatus, adStatus === 200 ? JSON.stringify(ad) : "");
    return reply(204);
  });
  on("process.run", async (_$, e) => {
    opened.push(e.argv);
    return {
      value: {
        exitCode: failingCommands.includes(e.argv[0] ?? "") ? 1 : 0,
        stdout: `${PNG}\n`,
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    };
  });
  on("ui.toast", async (_$, e) => {
    toasts.push(e.text);
    return { value: undefined };
  });
  on("ui.status", async (_$, e) => {
    statuses.push(e.text);
    return { value: undefined };
  });
  on("session.start", async (_$, e) => ({ cwd: e.cwd }));
  on("command.register", async (_$, e) => ({ value: { command: e.name } }));
  mock.store(on, store);
  on("settings.read", async (_$, e) => {
    const envs: Record<string, Record<string, string>> = {
      project: projectEnv,
      user: userEnv,
      flag: flagEnv,
    };
    const env = e.source && envs[e.source];
    return { value: env ? { env } : {} };
  });
  const clock = mock.clock(on);
  on("session.id", async () => ({ value: "session_abc" }));
  on("prompt.submit", async (_$, e) => ({ text: e.text }));
  on("turn.complete", async (_$, e) => ({ text: e.answer }));
  on("command.run", async () => ({ text: "" }));
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>engine row</Text>;
  });
  return { calls, toasts, statuses, opened, clock };
}

const KEY = "sq_connected_key";
const CONNECTED = { store: { deviceKey: KEY } };
const adRequests = (calls: Call[]) => calls.filter((c) => c.url === `${SITE}/api/ad`);
const keyOf = (call?: Call) => call?.auth?.replace("Bearer ", "");

type Engine = Parameters<Parameters<typeof test>[2] & Function>[0];

async function connect($: Engine) {
  const { text } = await $.command.run({
    command: "sidequest-connect",
    args: "",
    origin: { kind: "composer" },
    presentation: { isFullscreen: false, columns: 120 },
  });
  return text ?? "";
}

async function answer($: Engine, question = QUESTION) {
  await $.prompt.submit({ text: question, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
}

const message = (text: string) => ({
  plugin: "sidequest",
  component: "AssistantMessage" as const,
  props: { text, isFirstOfReply: false },
  requestId: "msg_1",
});

test("requests no ad before the account is connected", async ($, on) => {
  const { calls } = world(on);
  await connect($);
  await answer($);
  expect(adRequests(calls)).toHaveLength(0);
});

test("/sidequest-connect shows the code and opens a link that carries none", async ($, on) => {
  const { opened } = world(on);
  const text = await connect($);

  expect(text).toContain("**BCDF-GHJK**");
  expect(text).toContain(`${SITE}/connect `);
  expect(opened).toContainEqual(["open", `${SITE}/connect`]);
});

test("/sidequest-connect tries the next opener when open fails", async ($, on) => {
  const { opened } = world(on, { failingCommands: ["open"] });
  await connect($);

  expect(opened).toContainEqual(["xdg-open", `${SITE}/connect`]);
});

test("once the site confirms the code, the mod names the account and requests ads with that key", async ($, on) => {
  const { calls, toasts, clock } = world(on, { polls: [202, 200] });
  await connect($);
  await clock.advance(1000);
  expect(toasts).toEqual([]);
  await clock.advance(1000);
  await answer($);

  const created = calls.find((c) => c.method === "POST" && c.url === `${SITE}/api/device`);
  expect(toasts).toEqual(["Sidequest connected as ada@example.com."]);
  expect(keyOf(adRequests(calls)[0])).toBe(keyOf(created));
});

test("an expired code ends the poll without connecting", async ($, on) => {
  const { calls, toasts, clock } = world(on, { polls: [404] });
  await connect($);
  await clock.advance(1000);
  await answer($);

  expect(toasts).toEqual(["Sidequest: the code expired. Run /sidequest-connect again."]);
  expect(adRequests(calls)).toHaveLength(0);
});

test("a second /sidequest-connect replaces the first, so only its key is connected", async ($, on) => {
  const { calls, toasts, clock } = world(on, { polls: [200, 200] });
  await connect($);
  await connect($);
  await clock.advance(1000);
  await answer($);

  const created = calls.filter((c) => c.method === "POST" && c.url === `${SITE}/api/device`);
  expect(toasts).toHaveLength(1);
  expect(keyOf(adRequests(calls)[0])).toBe(keyOf(created[1]));
});

test("resumes a connection left pending by a restart", async ($, on) => {
  const { toasts, clock } = world(on, {
    store: { pending: { key: "sq_pending", expiresAt: 600000 } },
    polls: [200],
  });
  await $.session.start({ cwd: "/tmp", surface: "terminal", isInteractive: true });
  await clock.advance(1000);
  expect(toasts).toEqual(["Sidequest connected as ada@example.com."]);
});

test("ignores a SIDEQUEST_URL set only in project settings", async ($, on) => {
  const { calls } = world(on, { projectEnv: { SIDEQUEST_URL: "http://localhost:3001" } });
  await connect($);
  expect(calls.every((c) => c.url.startsWith(SITE))).toBe(true);
});

test("uses a loopback SIDEQUEST_URL from user settings", async ($, on) => {
  const { calls } = world(on, { userEnv: { SIDEQUEST_URL: "http://localhost:3001" } });
  await connect($);
  expect(calls.every((c) => c.url.startsWith("http://localhost:3001"))).toBe(true);
});

test("uses a loopback SIDEQUEST_URL from the --settings flag over user settings", async ($, on) => {
  const { calls } = world(on, {
    userEnv: { SIDEQUEST_URL: "http://localhost:3001" },
    flagEnv: { SIDEQUEST_URL: "http://127.0.0.1:3002" },
  });
  await connect($);
  expect(calls.every((c) => c.url.startsWith("http://127.0.0.1:3002"))).toBe(true);
});

test("ignores a non-loopback SIDEQUEST_URL from user settings", async ($, on) => {
  const { calls } = world(on, { userEnv: { SIDEQUEST_URL: "http://localhost.evil.example" } });
  await connect($);
  expect(calls.every((c) => c.url.startsWith(SITE))).toBe(true);
});

test("shows the suspended status when the site refuses a banned account", async ($, on) => {
  const { statuses } = world(on, { ...CONNECTED, adStatus: 403 });
  await answer($);
  expect(statuses).toContain("sidequest: account suspended");
});

for (const surface of ["terminal", "desktop"] as const) {
  test(
    `shows a labeled ad under the last message of the answer and reports one impression (${surface})`,
    { options: OPTIONS },
    async ($, on) => {
      const { calls, clock } = world(on, CONNECTED);
      await answer($);

      const request = adRequests(calls)[0];
      expect(keyOf(request)).toBe(KEY);
      expect(JSON.parse(request?.body ?? "{}")).toEqual({
        question: QUESTION,
        answer: ANSWER,
        conversationId: "session_abc",
        demo: true,
      });

      const ui = await $.ui.mount({ ...message("Prioritize fit and cushioning."), surface });
      expect(await ui.find({ text: /Example Brand/ })).toBeDefined();
      expect(await ui.find({ text: /Sponsored/ })).toBeDefined();
      expect(await ui.find({ type: surface === "terminal" ? "Image" : "Svg" })).toBeDefined();
      if (surface === "desktop") {
        const svg = await ui.find({ type: "Svg" });
        expect(svg?.props.source).toContain(`data:image/png;base64,${PNG}`);
        expect(svg?.props.alt).toBe("Example Brand logo");
      }
      expect(await ui.find({ type: "Link", text: /Explore/ })).toBeDefined();

      await clock.settle();
      const impressions = calls.filter((c) => c.url === IMPRESSION_URL);
      expect(impressions).toHaveLength(1);
      expect(impressions[0]?.auth).toBe(`Bearer ${KEY}`);
      await ui.unmount();
    },
  );
}

test("renders no ad and sends no request for a slot without a valid impressionId", async ($, on) => {
  const { calls, clock } = world(on, { ...CONNECTED, ad: { ...AD, impressionId: "../../evil" } });
  await answer($);

  const ui = await $.ui.mount({
    ...message("Prioritize fit and cushioning."),
    surface: "terminal",
  });
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined();

  await clock.settle();
  expect(calls.filter((c) => c.url.includes("/api/impression/"))).toHaveLength(0);
});

test("leaves the earlier messages of the answer alone", async ($, on) => {
  world(on, CONNECTED);
  await answer($);

  const ui = await $.ui.mount({ ...message("Look at fit first."), surface: "desktop" });
  expect(await ui.find({ text: /engine row/ })).toBeDefined();
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined();
});

test("/sidequest hides the ad and stops requests", async ($, on) => {
  const { calls } = world(on, CONNECTED);
  await answer($);
  await $.command.run({
    command: "sidequest",
    args: "",
    origin: { kind: "composer" },
    presentation: { isFullscreen: false, columns: 120 },
  });

  const ui = await $.ui.mount({ ...message("Prioritize fit and cushioning."), surface: "desktop" });
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined();

  const before = adRequests(calls).length;
  await answer($);
  expect(adRequests(calls)).toHaveLength(before);
});

test("requests nothing when the question is blank", async ($, on) => {
  const { calls } = world(on, CONNECTED);
  await answer($, "  ");
  expect(adRequests(calls)).toHaveLength(0);
});

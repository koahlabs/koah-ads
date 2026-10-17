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
  osEnv?: Record<string, string>;
  unameOutput?: string;
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
    osEnv = {},
    unameOutput = "Darwin\n",
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
        stdout: e.argv[0] === "uname" ? unameOutput : `${PNG}\n`,
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
  mock.env(on, osEnv);
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

const message = (text: string) => ({
  plugin: "sidequest",
  component: "AssistantMessage" as const,
  props: { text, isFirstOfReply: false },
  requestId: "msg_1",
});

test("requests no ad before the account is connected", async ($, on) => {
  const { calls } = world(on);
  await connect($);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  expect(adRequests(calls)).toHaveLength(0);
});

test("/sidequest-connect shows the plain link and code", async ($, on) => {
  world(on);
  const text = await connect($);

  expect(text).toContain(`${SITE}/connect `);
  expect(text).toContain("**BCDF-GHJK**");
});

test("keeps the code on the status line while the connection is pending", async ($, on) => {
  const { statuses } = world(on);
  await connect($);

  expect(statuses.at(-1)).toContain(`${SITE}/connect and enter code BCDF-GHJK`);
});

const URL_WITH_CODE = `${SITE}/connect?code=BCDF-GHJK`;
const CONNECT_ROWS = [
  { os: "macos", options: { unameOutput: "Darwin\n" }, opener: ["open", URL_WITH_CODE] },
  { os: "linux", options: { unameOutput: "Linux\n" }, opener: ["xdg-open", URL_WITH_CODE] },
  {
    os: "windows",
    options: { osEnv: { OS: "Windows_NT" } },
    opener: ["rundll32", "url.dll,FileProtocolHandler", URL_WITH_CODE],
  },
];

for (const { os, options, opener } of CONNECT_ROWS) {
  test(`/sidequest-connect on ${os} reports the os and opens the link with ${opener[0]}`, async ($, on) => {
    const { calls, opened } = world(on, options);
    await connect($);

    const start = calls.find((c) => c.method === "POST");
    expect(JSON.parse(start?.body ?? "")).toEqual({ os });
    expect(opened).toContainEqual(opener);
  });
}

test("/sidequest-connect tries every opener when the os is unknown", async ($, on) => {
  const { calls, opened } = world(on, {
    unameOutput: "FreeBSD\n",
    failingCommands: ["open", "xdg-open"],
  });
  await connect($);

  const start = calls.find((c) => c.method === "POST");
  expect(JSON.parse(start?.body ?? "{}")).toEqual({});
  const openers = opened.filter((argv) => argv.at(-1)?.includes("/connect?code="));
  expect(openers.map((argv) => argv[0])).toEqual(["open", "xdg-open", "rundll32"]);
});

test("once the site confirms the code, the mod names the account and requests ads with that key", async ($, on) => {
  const { calls, toasts, clock } = world(on, { polls: [202, 200] });
  await connect($);
  await clock.advance(1000);
  expect(toasts).toEqual([]);
  await clock.advance(1000);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

  const created = calls.find((c) => c.method === "POST" && c.url === `${SITE}/api/device`);
  expect(toasts).toEqual(["Sidequest connected as ada@example.com."]);
  expect(keyOf(adRequests(calls)[0])).toBe(keyOf(created));
});

test("an expired code ends the poll without connecting", async ($, on) => {
  const { calls, toasts, clock } = world(on, { polls: [404] });
  await connect($);
  await clock.advance(1000);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

  expect(toasts).toEqual(["Sidequest: the code expired. Run /sidequest-connect again."]);
  expect(adRequests(calls)).toHaveLength(0);
});

test("a second /sidequest-connect replaces the first, so only its key is connected", async ($, on) => {
  const { calls, toasts, clock } = world(on, { polls: [200, 200] });
  await connect($);
  await connect($);
  await clock.advance(1000);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

  const created = calls.filter((c) => c.method === "POST" && c.url === `${SITE}/api/device`);
  expect(toasts).toHaveLength(1);
  expect(keyOf(adRequests(calls)[0])).toBe(keyOf(created[1]));
});

test("resumes a connection left pending by a restart", async ($, on) => {
  const { toasts, clock } = world(on, {
    store: { pending: { key: "sq_pending", expiresAt: 600000, userCode: "BCDF-GHJK" } },
    polls: [200],
  });
  await $.session.start({ cwd: "/tmp", surface: "terminal", isInteractive: true });
  await clock.advance(1000);
  expect(toasts).toEqual(["Sidequest connected as ada@example.com."]);
});

test("a poll whose code another session already confirmed clears its status line", async ($, on) => {
  const { statuses, toasts, clock } = world(on, {
    store: { pending: { key: "sq_pending", expiresAt: 600000, userCode: "BCDF-GHJK" } },
    polls: [200, 202],
  });
  await $.session.start({ cwd: "/tmp", surface: "terminal", isInteractive: true });
  await $.session.start({ cwd: "/tmp", surface: "terminal", isInteractive: true });
  await clock.advance(1000);

  expect(toasts).toHaveLength(1);
  expect(statuses.slice(-2)).toEqual([undefined, undefined]);
});

test("a session with no key reminds the user to run /sidequest-connect", async ($, on) => {
  const { calls, toasts, clock } = world(on);
  await $.session.start({ cwd: "/tmp", surface: "terminal", isInteractive: true });
  await clock.settle();

  expect(calls).toHaveLength(0);
  expect(toasts).toEqual(["sidequest: run /sidequest-connect to link your account"]);
});

test("ignores a SIDEQUEST_URL set only in project settings", async ($, on) => {
  const { calls } = world(on, { projectEnv: { SIDEQUEST_URL: "http://localhost:3001" } });
  await connect($);
  expect(calls[0]?.url.startsWith(SITE)).toBe(true);
});

test("uses a loopback SIDEQUEST_URL from user settings", async ($, on) => {
  const { calls } = world(on, { userEnv: { SIDEQUEST_URL: "http://localhost:3001" } });
  await connect($);
  expect(calls[0]?.url.startsWith("http://localhost:3001")).toBe(true);
});

test("uses a loopback SIDEQUEST_URL from the --settings flag over user settings", async ($, on) => {
  const { calls } = world(on, {
    userEnv: { SIDEQUEST_URL: "http://localhost:3001" },
    flagEnv: { SIDEQUEST_URL: "http://127.0.0.1:3002" },
  });
  await connect($);
  expect(calls[0]?.url.startsWith("http://127.0.0.1:3002")).toBe(true);
});

test("ignores a non-loopback SIDEQUEST_URL from user settings", async ($, on) => {
  const { calls } = world(on, { userEnv: { SIDEQUEST_URL: "http://localhost.evil.example" } });
  await connect($);
  expect(calls[0]?.url.startsWith(SITE)).toBe(true);
});

test("shows the suspended status when the site refuses a banned account", async ($, on) => {
  const { statuses } = world(on, { ...CONNECTED, adStatus: 403 });
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  expect(statuses).toContain("sidequest: account suspended");
});

test("sends the question, answer and session id with the device key", async ($, on) => {
  const { calls } = world(on, CONNECTED);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

  const request = adRequests(calls)[0];
  expect(keyOf(request)).toBe(KEY);
  expect(JSON.parse(request?.body ?? "{}")).toEqual({
    question: QUESTION,
    answer: ANSWER,
    conversationId: "session_abc",
  });
});

for (const surface of ["terminal", "desktop"] as const) {
  test(`shows a labeled ad under the last message of the answer (${surface})`, async ($, on) => {
    world(on, CONNECTED);
    await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
    await $.turn.complete({
      answer: ANSWER,
      durationMs: 10,
      isAborted: false,
      turnId: "t1",
      reason: "answer",
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
    await ui.unmount();
  });
}

test("reports an impression once even when the ad renders twice", async ($, on) => {
  const { calls, clock } = world(on, CONNECTED);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

  const first = await $.ui.mount({
    ...message("Prioritize fit and cushioning."),
    surface: "terminal",
  });
  await clock.settle();
  await first.unmount();
  const second = await $.ui.mount({
    ...message("Prioritize fit and cushioning."),
    surface: "terminal",
  });
  await clock.settle();
  await second.unmount();

  const impressions = calls.filter((c) => c.url === IMPRESSION_URL);
  expect(impressions).toHaveLength(1);
  expect(impressions[0]?.auth).toBe(`Bearer ${KEY}`);
});

test("renders no ad and reports no impression for an ad without a valid impressionId", async ($, on) => {
  const { calls, clock } = world(on, { ...CONNECTED, ad: { ...AD, impressionId: "../../evil" } });
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

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
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });

  const ui = await $.ui.mount({ ...message("Look at fit first."), surface: "desktop" });
  expect(await ui.find({ text: /engine row/ })).toBeDefined();
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined();
});

test("/sidequest hides the ad and stops requests", async ($, on) => {
  const { calls } = world(on, CONNECTED);
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  await $.command.run({
    command: "sidequest",
    args: "",
    origin: { kind: "composer" },
    presentation: { isFullscreen: false, columns: 120 },
  });

  const ui = await $.ui.mount({ ...message("Prioritize fit and cushioning."), surface: "desktop" });
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined();

  const before = adRequests(calls).length;
  await $.prompt.submit({ text: QUESTION, wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  expect(adRequests(calls)).toHaveLength(before);
});

test("requests nothing when the question is blank", async ($, on) => {
  const { calls } = world(on, CONNECTED);
  await $.prompt.submit({ text: "  ", wait: false, origin: { kind: "composer" } });
  await $.turn.complete({
    answer: ANSWER,
    durationMs: 10,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  expect(adRequests(calls)).toHaveLength(0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { notifyWaitlistSignup } from "../src/lib/waitlist-slack.ts";

const env = {
  LOOPS_API_KEY: "loops-test-key",
  SETTINGS__KOAH_INFO_SLACK_URL: "https://hooks.slack.com/services/TEST/TEST/TEST",
};
const signup = { email: "hello@example.com", joinedAt: "2026-10-13T12:00:00.000Z" };
const pending = { muxWaitlistSlackNotified: false };

function provider(responses) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, ...options, data: options.body ? JSON.parse(options.body) : undefined });
      const next = responses.shift();
      assert.ok(next, "unexpected provider request");
      if (next.error) throw next.error;
      return typeof next.body === "string"
        ? new Response(next.body, { status: next.status || 200 })
        : Response.json(next.body, { status: next.status || 200 });
    },
  };
}

test("sends the signup to Slack and persists delivery only after Slack confirms success", async () => {
  const mock = provider([{ body: [pending] }, { body: "ok" }, { body: { success: true } }]);
  await notifyWaitlistSignup(signup, env, mock.fetch);
  assert.equal(mock.calls.length, 3);
  assert.equal(mock.calls[1].url, env.SETTINGS__KOAH_INFO_SLACK_URL);
  assert.equal(
    mock.calls[1].headers.Authorization,
    undefined,
    "never send the Loops API key to Slack",
  );
  assert.equal(mock.calls[1].redirect, "error");
  assert.deepEqual(mock.calls[1].data, {
    text: "⚔️ Sidequest — new waitlist signup\n📧 Email: hello@example.com\n🗓️ Joined: 2026-10-13T12:00:00.000Z",
    mrkdwn: false,
    unfurl_links: false,
    unfurl_media: false,
  });
  assert.deepEqual(mock.calls[2].data, { email: signup.email, muxWaitlistSlackNotified: true });
});

test("missing credentials and invalid webhook destinations never make a request", async () => {
  const mock = provider([]);
  await notifyWaitlistSignup(signup, {}, mock.fetch);
  await notifyWaitlistSignup(signup, { LOOPS_API_KEY: env.LOOPS_API_KEY }, mock.fetch);
  for (const url of [
    "http://hooks.slack.com/services/TEST",
    "https://attacker.example/services/TEST",
    "https://hooks.slack.com.attacker.example/services/TEST",
    "https://hooks.slack.com/other",
    "https://user:password@hooks.slack.com/services/TEST",
    "not a URL",
  ]) {
    await notifyWaitlistSignup(signup, { ...env, SETTINGS__KOAH_INFO_SLACK_URL: url }, mock.fetch);
  }
  assert.equal(mock.calls.length, 0);
});

test("delivered contacts and historical contacts do not send another message", async () => {
  for (const contact of [{ muxWaitlistSlackNotified: true }, {}, null]) {
    const mock = provider([{ body: contact ? [contact] : [] }]);
    await notifyWaitlistSignup(signup, env, mock.fetch);
    assert.equal(mock.calls.length, 1);
  }
});

test("Slack errors and lost responses leave delivery pending without rejecting", async () => {
  for (const result of [
    { status: 429, body: "rate_limited" },
    { status: 500, body: "failed" },
    { body: "invalid_payload" },
    { error: new Error("private webhook error") },
  ]) {
    const mock = provider([{ body: [pending] }, result]);
    await assert.doesNotReject(notifyWaitlistSignup(signup, env, mock.fetch));
    assert.equal(mock.calls.length, 2);
  }
});

test("contact lookup failures never send Slack or record delivery", async () => {
  for (const result of [{ status: 500, body: {} }, { body: {} }, { body: "invalid JSON" }]) {
    const mock = provider([result]);
    await notifyWaitlistSignup(signup, env, mock.fetch);
    assert.equal(mock.calls.length, 1);
  }
});

test("transient marker failure retries the write without sending Slack again", async () => {
  const mock = provider([
    { body: [pending] },
    { body: "ok" },
    { status: 500, body: { success: false } },
    { body: { success: true } },
  ]);
  await notifyWaitlistSignup(signup, env, mock.fetch);
  assert.equal(
    mock.calls.filter((call) => call.url === env.SETTINGS__KOAH_INFO_SLACK_URL).length,
    1,
  );
  assert.equal(mock.calls.filter((call) => call.data?.muxWaitlistSlackNotified === true).length, 2);
});

test("same-instance concurrent notifications send one message", async () => {
  const mock = provider([{ body: [pending] }, { body: "ok" }, { body: { success: true } }]);
  await Promise.all([
    notifyWaitlistSignup(signup, env, mock.fetch),
    notifyWaitlistSignup(signup, env, mock.fetch),
  ]);
  assert.equal(mock.calls.length, 3);
});

test("failure logs exclude email addresses, credentials, and provider messages", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args.join(" ")));
  const mock = provider([
    { body: [pending] },
    {
      error: new Error(`${signup.email} ${env.LOOPS_API_KEY} ${env.SETTINGS__KOAH_INFO_SLACK_URL}`),
    },
  ]);
  await notifyWaitlistSignup(signup, env, mock.fetch);
  assert.match(logs.join("\n"), /Slack notification request failed/);
  for (const secret of [signup.email, env.LOOPS_API_KEY, env.SETTINGS__KOAH_INFO_SLACK_URL])
    assert.ok(!logs.join("\n").includes(secret));
});

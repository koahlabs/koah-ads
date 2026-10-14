import { test } from "node:test";
import assert from "node:assert/strict";
import { handleWaitlist } from "../src/lib/waitlist.ts";

const env = { LOOPS_API_KEY: "test-key", LOOPS_WAITLIST_TRANSACTIONAL_ID: "welcome-template" };
let client = 0;
function request(body, headers = {}) {
  return new Request("https://mux.example/api/waitlist", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++client}`, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function provider(responses) {
  const calls = [];
  return { calls, fetch: async (url, options) => { calls.push({ url, ...options, data: options.body ? JSON.parse(options.body) : undefined }); const next = responses.shift(); assert.ok(next, "unexpected provider request"); return Response.json(next.body, { status: next.status || 200 }); } };
}
const signup = { email: "  HELLO@example.com ", consent: true };

test("rejects invalid email, malformed JSON, missing consent, cross-origin requests, and oversized bodies before calling Loops", async () => {
  const mock = provider([]);
  for (const body of [{ ...signup, email: "not-an-email" }, { ...signup, consent: false }, { ...signup, website: "spam" }, "{", "null"]) assert.equal((await handleWaitlist(request(body), env, mock.fetch)).status, 400);
  assert.equal((await handleWaitlist(request(signup, { origin: "https://other.example" }), env, mock.fetch)).status, 403);
  assert.equal((await handleWaitlist(request("x".repeat(4097)), env, mock.fetch)).status, 413);
  assert.equal(mock.calls.length, 0);
});
test("does not claim a signup succeeded when Loops is not configured", async () => {
  assert.equal((await handleWaitlist(request(signup), {}, provider([]).fetch)).status, 503);
});
test("persists a new signup, sends the welcome email, and records delivery without changing global preferences", async () => {
  const mock = provider([{ body: [] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  const response = await handleWaitlist(request(signup), env, mock.fetch);
  assert.deepEqual(await response.json(), { success: true, emailSent: true });
  assert.equal(mock.calls[1].data.email, "hello@example.com");
  assert.equal(mock.calls[1].data.source, "mux-waitlist");
  assert.ok(mock.calls[1].data.muxWaitlistJoinedAt);
  assert.equal(mock.calls[1].data.subscribed, undefined);
  assert.equal(mock.calls[2].data.addToAudience, false);
  assert.match(mock.calls[2].headers["Idempotency-Key"], /^[a-f0-9]{64}$/);
  assert.equal(mock.calls[3].data.muxWaitlistWelcomeSent, true);
});
test("does not send another welcome email for an existing signup", async () => {
  const mock = provider([{ body: [{ muxWaitlistJoinedAt: "2026-10-01T00:00:00.000Z", muxWaitlistWelcomeSent: true, subscribed: false }] }, { body: { success: true } }]);
  assert.deepEqual(await (await handleWaitlist(request(signup), env, mock.fetch)).json(), { success: true, emailSent: false });
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[1].data.muxWaitlistJoinedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(mock.calls[1].data.subscribed, undefined);
  assert.equal(mock.calls[1].data.source, undefined);
});
test("retries an email failure with the same idempotency key and never records a failed send", async () => {
  const first = provider([{ body: [] }, { body: { success: true } }, { status: 500, body: { success: false } }]);
  const failed = await handleWaitlist(request(signup), env, first.fetch);
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).message, /saved your place/);
  assert.equal(first.calls.length, 3);
  const retry = provider([{ body: [{ muxWaitlistJoinedAt: "2026-10-01T00:00:00.000Z" }] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  assert.equal((await handleWaitlist(request(signup), env, retry.fetch)).status, 200);
  assert.equal(first.calls[2].headers["Idempotency-Key"], retry.calls[2].headers["Idempotency-Key"]);
});
test("does not treat a conflicting payload as a delivered email", async () => {
  const mock = provider([{ body: [] }, { body: { success: true } }, { status: 409, body: { success: false, message: "Idempotency key already used with a different request body." } }]);
  assert.equal((await handleWaitlist(request(signup), env, mock.fetch)).status, 502);
});
test("reports a sent email as sent when every marker update fails", async () => {
  const failure = { status: 500, body: { success: false } };
  const mock = provider([{ body: [] }, { body: { success: true } }, { body: { success: true } }, failure, failure, failure]);
  assert.deepEqual(await (await handleWaitlist(request(signup), env, mock.fetch)).json(), { success: true, emailSent: true });
  assert.equal(mock.calls.filter((call) => call.data?.muxWaitlistWelcomeSent === true).length, 3);
});
test("retries the marker after a rejected or unreadable response and records it", async () => {
  const responses = [{ body: [] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }];
  const calls = [];
  let markerAttempts = 0;
  const fetcher = async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, data });
    if (data?.muxWaitlistWelcomeSent === true && ++markerAttempts === 1) throw new Error("network");
    if (data?.muxWaitlistWelcomeSent === true && markerAttempts === 2) return new Response("not json", { status: 200 });
    return Response.json(responses.shift().body);
  };
  assert.deepEqual(await (await handleWaitlist(request(signup), env, fetcher)).json(), { success: true, emailSent: true });
  assert.equal(markerAttempts, 3);
});
test("does not send email when saving the signup fails", async () => {
  const mock = provider([{ body: [] }, { status: 429, body: { success: false } }]);
  assert.equal((await handleWaitlist(request(signup), env, mock.fetch)).status, 502);
  assert.equal(mock.calls.length, 2);
});
test("limits repeat requests from one client", async () => {
  const headers = { "x-forwarded-for": "192.0.2.250" };
  for (let i = 0; i < 8; i++) {
    const mock = provider([{ body: [{ muxWaitlistWelcomeSent: true }] }, { body: { success: true } }]);
    assert.equal((await handleWaitlist(request(signup, headers), env, mock.fetch)).status, 200);
  }
  assert.equal((await handleWaitlist(request(signup, headers), env, provider([]).fetch)).status, 429);
});

test("queues a Slack notification after storage even when the welcome email fails", async () => {
  const events = [];
  const mock = provider([{ body: [] }, { body: { success: true } }, { status: 500, body: { success: false } }]);
  const response = await handleWaitlist(request(signup), env, mock.fetch, event => {
    assert.equal(mock.calls.length, 2, "the contact must be saved before scheduling Slack");
    events.push(event);
  });
  assert.equal(response.status, 502);
  assert.equal(mock.calls[1].data.muxWaitlistSlackNotified, false);
  assert.deepEqual(events, [{ email: "hello@example.com", joinedAt: mock.calls[1].data.muxWaitlistJoinedAt }]);
});

test("notifies an existing Loops contact joining the waitlist for the first time", async () => {
  const events = [];
  const mock = provider([{ body: [{ subscribed: false }] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  assert.equal((await handleWaitlist(request(signup), env, mock.fetch, event => events.push(event))).status, 200);
  assert.equal(events.length, 1);
  assert.equal(mock.calls[1].data.muxWaitlistSlackNotified, false);
  assert.equal(mock.calls[1].data.subscribed, undefined);
});

test("only pending repeat signups queue Slack; old and delivered signups stay quiet", async () => {
  for (const marker of [false, true, undefined]) {
    const events = [];
    const joinedAt = "2026-10-01T00:00:00.000Z";
    const mock = provider([{ body: [{ muxWaitlistJoinedAt: joinedAt, muxWaitlistWelcomeSent: true, muxWaitlistSlackNotified: marker }] }, { body: { success: true } }]);
    assert.equal((await handleWaitlist(request(signup), env, mock.fetch, event => events.push(event))).status, 200);
    assert.deepEqual(events, marker === false ? [{ email: "hello@example.com", joinedAt }] : []);
    assert.equal(mock.calls[1].data.muxWaitlistSlackNotified, undefined, "do not overwrite a persisted marker on resubmission");
  }
});

test("failed storage and invalid inputs never queue Slack", async () => {
  const notify = () => assert.fail("must not notify for a rejected signup");
  assert.equal((await handleWaitlist(request({ ...signup, consent: false }), env, provider([]).fetch, notify)).status, 400);
  const mock = provider([{ body: [] }, { status: 500, body: { success: false } }]);
  assert.equal((await handleWaitlist(request(signup), env, mock.fetch, notify)).status, 502);
});

test("scheduling failures do not change the signup response", async () => {
  const mock = provider([{ body: [] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  const response = await handleWaitlist(request(signup), env, mock.fetch, () => { throw new Error("scheduler unavailable"); });
  assert.deepEqual(await response.json(), { success: true, emailSent: true });
});

test("counts a newly saved signup without a Slack webhook and before welcome delivery", async () => {
  let events = 0;
  const mock = provider([{ body: [] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  const response = await handleWaitlist(request(signup), env, mock.fetch, undefined, lead => {
    events++;
    assert.equal(mock.calls.length, 2, "the contact must be stored before counting the signup");
    assert.deepEqual(lead, { email: "hello@example.com", joinedAt: mock.calls[1].data.muxWaitlistJoinedAt });
  });
  assert.equal(response.status, 200);
  assert.equal(events, 1);
  assert.equal(mock.calls[1].data.muxWaitlistSlackNotified, undefined);
});

test("counts a newly saved signup even when welcome delivery or Slack scheduling fails", async () => {
  let events = 0;
  const mock = provider([{ body: [] }, { body: { success: true } }, { status: 500, body: { success: false } }]);
  const response = await handleWaitlist(request(signup), env, mock.fetch,
    () => { throw new Error("Slack scheduler unavailable"); },
    () => { events++; });
  assert.equal(response.status, 502);
  assert.equal(events, 1);
});

test("repeat submissions and pending Slack retries do not increase the signup count", async () => {
  const notify = () => assert.fail("existing members must not produce another analytics event");
  for (const marker of [false, true, undefined]) {
    const mock = provider([{ body: [{ muxWaitlistJoinedAt: "2026-10-13T12:00:00.000Z", muxWaitlistWelcomeSent: true, muxWaitlistSlackNotified: marker }] }, { body: { success: true } }]);
    assert.equal((await handleWaitlist(request(signup), env, mock.fetch, () => {}, notify)).status, 200);
  }
});

test("invalid requests and failed saves do not count as signups", async () => {
  const notify = () => assert.fail("rejected signups must not produce an analytics event");
  assert.equal((await handleWaitlist(request({ ...signup, consent: false }), env, provider([]).fetch, undefined, notify)).status, 400);
  const mock = provider([{ body: [] }, { status: 500, body: { success: false } }]);
  assert.equal((await handleWaitlist(request(signup), env, mock.fetch, undefined, notify)).status, 502);
});

test("an analytics scheduling failure cannot block a signup or its Slack notification", async () => {
  let slackEvents = 0;
  const mock = provider([{ body: [] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  const response = await handleWaitlist(request(signup), env, mock.fetch,
    () => { slackEvents++; },
    () => { throw new Error("analytics scheduler unavailable"); });
  assert.deepEqual(await response.json(), { success: true, emailSent: true });
  assert.equal(slackEvents, 1);
});

test("an existing Loops contact joining the waitlist for the first time counts once", async () => {
  let events = 0;
  const mock = provider([{ body: [{ subscribed: false }] }, { body: { success: true } }, { body: { success: true } }, { body: { success: true } }]);
  assert.equal((await handleWaitlist(request(signup), env, mock.fetch, undefined, () => { events++; })).status, 200);
  assert.equal(events, 1);
});

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
test("preserves a saved signup if the final marker update fails", async () => {
  const mock = provider([{ body: [] }, { body: { success: true } }, { body: { success: true } }, { status: 500, body: { success: false } }]);
  assert.deepEqual(await (await handleWaitlist(request(signup), env, mock.fetch)).json(), { success: true, emailSent: true });
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

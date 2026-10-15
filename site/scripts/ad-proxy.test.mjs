import { test } from "node:test";
import assert from "node:assert/strict";
import { deviceConnectionStatus, generateUserCode, handleAdRequest, handleImpression, hashDeviceKey, startDeviceConnection } from "../src/lib/ad-proxy.ts";
import { formatUserCode, normalizeUserCode } from "../src/lib/user-code.ts";

const deviceKey = `sq_${"a".repeat(43)}`;
const queryId = "7f1c2e4a-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const env = { KOAH_SERVING_TOKEN: "serving-token", KOAH_PUBLISHER_ID: "publisher-1", KOAH_API_URL: "https://koah.example" };

function deps(responses = []) {
  const calls = [];
  return {
    calls,
    env,
    takeAdRequest: async (keyHash) => (keyHash === hashDeviceKey(deviceKey) ? { status: "connected", userId: "user-1" } : null),
    findDevice: async (keyHash) => (keyHash === hashDeviceKey(deviceKey) ? { status: "connected", userId: "user-1", email: "a@example.com" } : null),
    fetch: async (url, options) => {
      calls.push({ url, ...options, data: options.body ? JSON.parse(options.body) : undefined });
      const next = responses.shift();
      assert.ok(next, "unexpected Koah request");
      return next.body ? Response.json(next.body, { status: next.status || 200 }) : new Response(null, { status: next.status });
    },
  };
}
function adRequest(key = deviceKey, body = { question: "How do I rebase?" }) {
  return new Request("https://sidequest.example/api/ad", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    body: JSON.stringify(body),
  });
}
const impressionRequest = (key = deviceKey) => new Request("https://sidequest.example/api/impression/x", { method: "POST", headers: { authorization: `Bearer ${key}` } });

test("rejects an unknown device key without calling Koah", async () => {
  const mock = deps();
  const response = await handleAdRequest(adRequest(`sq_${"b".repeat(43)}`), mock);
  assert.equal(response.status, 401);
  assert.equal(mock.calls.length, 0);
});
test("rejects a banned device with 403 and never calls Koah", async () => {
  const mock = { ...deps(), takeAdRequest: async () => ({ status: "banned", userId: "user-1" }) };
  const response = await handleAdRequest(adRequest(), mock);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Account suspended" });
  assert.equal(mock.calls.length, 0);
});
test("forwards the question to Koah for the signed-in user and returns the impression id", async () => {
  const mock = deps([{ body: { ad: "Try Acme", impressionLink: `https://koah.example/api/v1/server/impression/${queryId}` } }]);
  const response = await handleAdRequest(adRequest(), mock);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ad: "Try Acme", impressionId: queryId });
  assert.equal(mock.calls[0].url, "https://koah.example/api/v1/server/request_ad");
  assert.equal(mock.calls[0].headers.Authorization, "Bearer serving-token");
  assert.deepEqual(mock.calls[0].data, {
    publisherId: "publisher-1",
    platform: "cli",
    user: { id: "user-1", ip: "203.0.113.9" },
    context: { type: "conversation", question: "How do I rebase?" },
    demo: false,
  });
});
test("returns no fill without calling Koah once the daily limit is used", async () => {
  const mock = { ...deps(), takeAdRequest: async () => ({ status: "over_limit", userId: "user-1" }) };
  assert.equal((await handleAdRequest(adRequest(), mock)).status, 204);
  assert.equal(mock.calls.length, 0);
});
test("reports a failed device lookup as 502 without calling Koah", async () => {
  const mock = { ...deps(), takeAdRequest: async () => { throw new Error("db down"); } };
  assert.equal((await handleAdRequest(adRequest(), mock)).status, 502);
  assert.equal(mock.calls.length, 0);
});
test("rejects a bad request before it costs a database call", async () => {
  let lookups = 0;
  const mock = { ...deps(), takeAdRequest: async () => { lookups++; return { status: "connected", userId: "user-1" }; } };
  const noIp = new Request("https://sidequest.example/api/ad", { method: "POST", headers: { authorization: `Bearer ${deviceKey}` }, body: "{}" });
  const noBody = new Request("https://sidequest.example/api/ad", { method: "POST", headers: { authorization: `Bearer ${deviceKey}`, "x-forwarded-for": "203.0.113.9" }, body: "not json" });
  assert.equal((await handleAdRequest(noIp, mock)).status, 503);
  assert.equal((await handleAdRequest(noBody, mock)).status, 422);
  assert.equal((await handleAdRequest(new Request("https://sidequest.example/api/ad", { method: "POST", body: "{}" }), mock)).status, 401);
  assert.equal(lookups, 0);
});
test("passes a Koah no-fill, rate limit or success through and reports other statuses as 502", async () => {
  for (const status of [204, 429]) assert.equal((await handleAdRequest(adRequest(), deps([{ status }]))).status, status);
  for (const status of [400, 401, 403, 422, 500]) assert.equal((await handleAdRequest(adRequest(), deps([{ status }]))).status, 502);
});
test("reports a Koah network error as 502", async () => {
  const mock = { ...deps(), fetch: async () => { throw new Error("offline"); } };
  assert.equal((await handleAdRequest(adRequest(), mock)).status, 502);
});
test("credits an impression with the serving token", async () => {
  const mock = deps([{ status: 204 }]);
  const response = await handleImpression(impressionRequest(), queryId, mock);
  assert.equal(response.status, 204);
  assert.equal(mock.calls[0].url, `https://koah.example/api/v1/server/impression/${queryId}`);
  assert.equal(mock.calls[0].headers.Authorization, "Bearer serving-token");
});
test("passes a Koah impression success or rate limit through and reports other statuses as 502", async () => {
  for (const status of [200, 429]) assert.equal((await handleImpression(impressionRequest(), queryId, deps([{ status }]))).status, status);
  for (const status of [401, 403]) assert.equal((await handleImpression(impressionRequest(), queryId, deps([{ status }]))).status, 502);
});
test("rejects an impression id that is not a UUID without calling Koah", async () => {
  const mock = deps();
  assert.equal((await handleImpression(impressionRequest(), "../request_ad", mock)).status, 404);
  assert.equal(mock.calls.length, 0);
});
test("rejects an unknown device key on an impression without calling Koah", async () => {
  const mock = deps();
  assert.equal((await handleImpression(impressionRequest(`sq_${"b".repeat(43)}`), queryId, mock)).status, 401);
  assert.equal(mock.calls.length, 0);
});

function deviceRequest(headers = {}) {
  return new Request("https://sidequest.example/api/device", {
    method: "POST",
    headers: { authorization: `Bearer ${deviceKey}`, "x-forwarded-for": "203.0.113.9, 10.0.0.1", ...headers },
  });
}
const getDeviceRequest = (key = deviceKey) => new Request("https://sidequest.example/api/device", { headers: { authorization: `Bearer ${key}` } });

test("generates user codes from the 20-letter alphabet only", () => {
  assert.match(generateUserCode(), /^[BCDFGHJKLMNPQRSTVWXZ]{8}$/);
});
test("normalizes typed user codes", () => {
  assert.equal(normalizeUserCode("bcdf-ghjk"), "BCDFGHJK");
  for (const input of ["BCDFGHJ", "BCDFGHJKL", "AEIOUBCD", "1234-5678", null]) assert.equal(normalizeUserCode(input), null);
});
test("formats user codes with a dash", () => {
  assert.equal(formatUserCode("BCDFGHJK"), "BCDF-GHJK");
  assert.equal(formatUserCode("BCDFG"), "BCDF-G");
  assert.equal(formatUserCode("BCD"), "BCD");
});
test("starts a device connection with the caller's ip and location", async () => {
  const started = [];
  const expiresAt = "2026-10-15T12:10:00.000+00:00";
  const startDevice = async (device) => { started.push(device); return expiresAt; };
  const response = await startDeviceConnection(deviceRequest({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR" }), { startDevice });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.match(body.userCode, /^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  assert.equal(body.expiresAt, expiresAt);
  assert.deepEqual(started, [{ keyHash: hashDeviceKey(deviceKey), userCode: normalizeUserCode(body.userCode), ip: "203.0.113.9", location: "São Paulo, BR" }]);
});
test("maps start errors to 429, 409 and 502", async () => {
  const statusFor = async (code) => (await startDeviceConnection(deviceRequest(), { startDevice: async () => { throw { code }; } })).status;
  assert.equal(await statusFor("P0429"), 429);
  assert.equal(await statusFor("23505"), 409);
  assert.equal(await statusFor("XX000"), 502);
});
test("reports device connection status", async () => {
  const statusFor = async (device, key) => {
    const response = await deviceConnectionStatus(getDeviceRequest(key), { findDevice: async () => device });
    return [response.status, await response.json()];
  };
  assert.deepEqual(await statusFor({ status: "connected", userId: "user-1", email: "a@example.com" }), [200, { email: "a@example.com" }]);
  assert.deepEqual(await statusFor({ status: "pending", userId: null, email: null }), [202, {}]);
  assert.deepEqual(await statusFor({ status: "banned", userId: "user-1", email: "a@example.com" }), [403, { error: "Account suspended" }]);
  assert.equal((await statusFor(null))[0], 404);
});

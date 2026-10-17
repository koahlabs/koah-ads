import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  deviceConnectionStatus,
  fetchUserEarnings,
  handleAdRequest,
  handleImpression,
  hashDeviceKey,
  startDeviceConnection,
  type DeviceStore,
} from "../src/lib/ad-proxy.ts";
import { formatUserCode, normalizeUserCode } from "../src/lib/user-code.ts";
import { fakeFetch, type FakeCall } from "./fake-fetch.ts";

const deviceKey = `sq_${"a".repeat(43)}`;
const queryId = "7f1c2e4a-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const env = {
  KOAH_SERVING_TOKEN: "serving-token",
  KOAH_PUBLISHER_ID: "publisher-1",
  KOAH_API_URL: "https://koah.example",
};

type StartedDevice = Parameters<DeviceStore["startDevice"]>[0];
type Reply = { body?: unknown; status?: number };

function deps(responses: Reply[] = []) {
  const calls: FakeCall[] = [];
  return {
    calls,
    env,
    takeAdRequest: async (keyHash: string): ReturnType<DeviceStore["takeAdRequest"]> =>
      keyHash === hashDeviceKey(deviceKey) ? { status: "connected", userId: "user-1" } : null,
    findDevice: async (keyHash: string): ReturnType<DeviceStore["findDevice"]> =>
      keyHash === hashDeviceKey(deviceKey)
        ? { status: "connected", userId: "user-1", email: "a@example.com" }
        : null,
    fetch: fakeFetch(async (url, options) => {
      calls.push({ url, ...options, data: options.body ? JSON.parse(options.body) : {} });
      const next = responses.shift();
      assert.ok(next, "unexpected Koah request");
      return next.body
        ? Response.json(next.body, { status: next.status || 200 })
        : new Response(null, { status: next.status });
    }),
  };
}
function adRequest(key = deviceKey, body = { question: "How do I rebase?" }) {
  return new Request("https://sidequest.example/api/ad", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    body: JSON.stringify(body),
  });
}
const impressionRequest = (key = deviceKey) =>
  new Request("https://sidequest.example/api/impression/x", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
  });

test("rejects an unknown device key without calling Koah", async () => {
  const mock = deps();
  const response = await handleAdRequest(adRequest(`sq_${"b".repeat(43)}`), mock);
  assert.equal(response.status, 401);
  assert.equal(mock.calls.length, 0);
});
test("rejects a banned device with 403 and never calls Koah", async () => {
  const mock = {
    ...deps(),
    takeAdRequest: async () => ({ status: "banned" as const, userId: "user-1" }),
  };
  const response = await handleAdRequest(adRequest(), mock);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Account suspended" });
  assert.equal(mock.calls.length, 0);
});
test("forwards the question to Koah for the signed-in user and returns the impression id", async () => {
  const mock = deps([
    {
      body: {
        ad: "Try Acme",
        impressionLink: `https://koah.example/api/v1/server/impression/${queryId}`,
      },
    },
  ]);
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
  });
});
test("fetches a user's daily earnings from Koah with the serving token", async () => {
  const earnings = [{ date: "2026-10-16", impressions: 1, revenueCents: 2 }];
  const mock = deps([{ body: { earnings } }]);
  assert.deepEqual(await fetchUserEarnings(mock, "user-1", "2026-10-01", "2026-10-16"), earnings);
  assert.equal(
    mock.calls[0].url,
    "https://koah.example/api/v1/server/users/user-1/earnings?starts_at=2026-10-01&ends_at=2026-10-16",
  );
  assert.equal(mock.calls[0].method, "GET");
  assert.equal(mock.calls[0].headers.Authorization, "Bearer serving-token");
});
test("fails when Koah rejects the earnings request", async () => {
  const mock = deps([{ status: 422 }]);
  await assert.rejects(fetchUserEarnings(mock, "user-1", "2026-10-16", "2026-10-01"));
});
test("returns no fill without calling Koah once the daily limit is used", async () => {
  const mock = {
    ...deps(),
    takeAdRequest: async () => ({ status: "over_limit" as const, userId: "user-1" }),
  };
  assert.equal((await handleAdRequest(adRequest(), mock)).status, 204);
  assert.equal(mock.calls.length, 0);
});
test("reports a failed device lookup as 502 without calling Koah", async () => {
  const mock = {
    ...deps(),
    takeAdRequest: async () => {
      throw new Error("db down");
    },
  };
  assert.equal((await handleAdRequest(adRequest(), mock)).status, 502);
  assert.equal(mock.calls.length, 0);
});
test("rejects a bad request before it costs a database call", async () => {
  let lookups = 0;
  const mock = {
    ...deps(),
    takeAdRequest: async () => {
      lookups++;
      return { status: "connected" as const, userId: "user-1" };
    },
  };
  const noIp = new Request("https://sidequest.example/api/ad", {
    method: "POST",
    headers: { authorization: `Bearer ${deviceKey}` },
    body: "{}",
  });
  const noBody = new Request("https://sidequest.example/api/ad", {
    method: "POST",
    headers: { authorization: `Bearer ${deviceKey}`, "x-forwarded-for": "203.0.113.9" },
    body: "not json",
  });
  assert.equal((await handleAdRequest(noIp, mock)).status, 503);
  assert.equal((await handleAdRequest(noBody, mock)).status, 422);
  assert.equal(
    (
      await handleAdRequest(
        new Request("https://sidequest.example/api/ad", { method: "POST", body: "{}" }),
        mock,
      )
    ).status,
    401,
  );
  assert.equal(lookups, 0);
});
test("passes a Koah no-fill, rate limit or success through and reports other statuses as 502", async () => {
  for (const status of [204, 429])
    assert.equal((await handleAdRequest(adRequest(), deps([{ status }]))).status, status);
  for (const status of [400, 401, 403, 422, 500])
    assert.equal((await handleAdRequest(adRequest(), deps([{ status }]))).status, 502);
});
test("reports a Koah network error as 502", async () => {
  const mock = {
    ...deps(),
    fetch: fakeFetch(async () => {
      throw new Error("offline");
    }),
  };
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
  for (const status of [200, 429])
    assert.equal(
      (await handleImpression(impressionRequest(), queryId, deps([{ status }]))).status,
      status,
    );
  for (const status of [401, 403])
    assert.equal(
      (await handleImpression(impressionRequest(), queryId, deps([{ status }]))).status,
      502,
    );
});
test("rejects an impression id that is not a UUID without calling Koah", async () => {
  const mock = deps();
  assert.equal((await handleImpression(impressionRequest(), "../request_ad", mock)).status, 404);
  assert.equal(mock.calls.length, 0);
});
test("rejects an unknown device key on an impression without calling Koah", async () => {
  const mock = deps();
  assert.equal(
    (await handleImpression(impressionRequest(`sq_${"b".repeat(43)}`), queryId, mock)).status,
    401,
  );
  assert.equal(mock.calls.length, 0);
});

function deviceRequest(headers: Record<string, string> = {}) {
  return new Request("https://sidequest.example/api/device", {
    method: "POST",
    headers: {
      authorization: `Bearer ${deviceKey}`,
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      ...headers,
    },
  });
}
const getDeviceRequest = (key = deviceKey) =>
  new Request("https://sidequest.example/api/device", {
    headers: { authorization: `Bearer ${key}` },
  });

test("normalizes typed user codes", () => {
  assert.equal(normalizeUserCode("bcdf-ghjk"), "BCDFGHJK");
  for (const input of ["BCDFGHJ", "BCDFGHJKL", "AEIOUBCD", "1234-5678", null])
    assert.equal(normalizeUserCode(input), null);
});
test("formats user codes with a dash", () => {
  assert.equal(formatUserCode("BCDFGHJK"), "BCDF-GHJK");
  assert.equal(formatUserCode("BCDFG"), "BCDF-G");
  assert.equal(formatUserCode("BCD"), "BCD");
});
test("starts a device connection with the caller's ip and location", async () => {
  const started: StartedDevice[] = [];
  const expiresAt = "2026-10-15T12:10:00.000+00:00";
  const startDevice = async (device: StartedDevice) => {
    started.push(device);
    return expiresAt;
  };
  const response = await startDeviceConnection(
    deviceRequest({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR" }),
    { startDevice },
  );
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.match(body.userCode, /^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  assert.equal(body.expiresAt, expiresAt);
  assert.deepEqual(started, [
    {
      keyHash: hashDeviceKey(deviceKey),
      userCode: normalizeUserCode(body.userCode),
      ip: "203.0.113.9",
      location: "São Paulo, BR",
      os: null,
    },
  ]);
});
test("stores the os a plugin reports and drops values outside the allowlist", async () => {
  const started: StartedDevice[] = [];
  const startDevice = async (device: StartedDevice) => {
    started.push(device);
    return "2026-10-15T12:10:00.000+00:00";
  };
  const withBody = (body: string) =>
    new Request("https://sidequest.example/api/device", {
      method: "POST",
      headers: { authorization: `Bearer ${deviceKey}`, "x-forwarded-for": "203.0.113.9" },
      body,
    });
  await startDeviceConnection(withBody(JSON.stringify({ os: "macos" })), { startDevice });
  await startDeviceConnection(withBody(JSON.stringify({ os: "toString" })), { startDevice });
  await startDeviceConnection(withBody("not json"), { startDevice });
  assert.deepEqual(
    started.map(({ os }) => os),
    ["macos", null, null],
  );
});
test("maps start errors to 429, 409 and 502", async () => {
  const statusFor = async (code: string) =>
    (
      await startDeviceConnection(deviceRequest(), {
        startDevice: async () => {
          throw { code };
        },
      })
    ).status;
  assert.equal(await statusFor("P0429"), 429);
  assert.equal(await statusFor("23505"), 409);
  assert.equal(await statusFor("XX000"), 502);
});
test("reports device connection status", async () => {
  const statusFor = async (
    device: Awaited<ReturnType<DeviceStore["findDevice"]>>,
    key?: string,
  ) => {
    const response = await deviceConnectionStatus(getDeviceRequest(key), {
      findDevice: async () => device,
    });
    return [response.status, await response.json()];
  };
  assert.deepEqual(
    await statusFor({ status: "connected", userId: "user-1", email: "a@example.com" }),
    [200, { email: "a@example.com" }],
  );
  assert.deepEqual(await statusFor({ status: "pending", userId: null, email: null }), [202, {}]);
  assert.deepEqual(
    await statusFor({ status: "banned", userId: "user-1", email: "a@example.com" }),
    [403, { error: "Account suspended" }],
  );
  assert.equal((await statusFor(null))[0], 404);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getWaitlistLeadNumber,
  seedWaitlistLeadNumbers,
  waitlistEmailHash,
} from "../src/lib/waitlist-lead-number.ts";
import { waitlistHashesFromCsv } from "./waitlist-import.ts";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://counter.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_counter_test",
};

test("the counter sends only an email hash to the authenticated server RPC", async () => {
  const result = await getWaitlistLeadNumber(" Hello@Example.com ", env, async (url, options) => {
    assert.equal(url, "https://counter.supabase.co/rest/v1/rpc/sidequest_register_waitlist_lead");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.deepEqual(JSON.parse(options.body), {
      p_email_hash: waitlistEmailHash("hello@example.com"),
    });
    assert.ok(!options.body.includes("hello@example.com"));
    return Response.json(42);
  });
  assert.equal(result, 42);
  assert.equal(waitlistEmailHash("HELLO@example.com"), waitlistEmailHash("hello@example.com"));
});

test("the counter accepts a local http Supabase URL outside production", async () => {
  const local = { ...env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
  const result = await getWaitlistLeadNumber("hello@example.com", local, async (url) => {
    assert.equal(url, "http://127.0.0.1:54321/rest/v1/rpc/sidequest_register_waitlist_lead");
    return Response.json(1);
  });
  assert.equal(result, 1);
});

test("invalid configuration and invalid numbers never produce an ordinal", async () => {
  for (const values of [
    {},
    { ...env, SUPABASE_SECRET_KEY: "sb_publishable_test" },
    { ...env, NEXT_PUBLIC_SUPABASE_URL: "http://counter.supabase.co" },
  ]) {
    assert.equal(
      await getWaitlistLeadNumber("hello@example.com", values, () => {
        throw new Error("No request expected");
      }),
      null,
    );
  }
  for (const value of [0, -1, 10.5, {}, null, "bad", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      await getWaitlistLeadNumber("hello@example.com", env, async () => Response.json(value)),
      null,
    );
  }
  assert.equal(
    await getWaitlistLeadNumber("hello@example.com", env, async () => Response.json("42")),
    42,
  );
  assert.equal(
    await getWaitlistLeadNumber(
      "hello@example.com",
      env,
      async () => new Response("fail", { status: 503 }),
    ),
    null,
  );
  assert.equal(
    await getWaitlistLeadNumber("hello@example.com", env, async () => {
      throw new Error("Private provider error");
    }),
    null,
  );
});

test("the import includes existing Sidequest leads, excludes other contacts, and orders first joins", () => {
  const csv =
    '\uFEFFEmail,muxWaitlistJoinedAt,Notes\r\nnew@example.com,2026-10-13T12:00:00Z,"hello, world"\r\nother@example.com,,other contact\r\nOld@Example.com,2026-10-12T12:00:00Z,"line one\nline two"\r\nold@example.com,2026-10-13T12:00:00Z,"escaped ""quote"""\r\n';
  assert.deepEqual(waitlistHashesFromCsv(csv), [
    waitlistEmailHash("old@example.com"),
    waitlistEmailHash("new@example.com"),
  ]);
  assert.throws(
    () => waitlistHashesFromCsv("email,source\nhello@example.com,API"),
    /muxWaitlistJoinedAt/,
  );
  assert.throws(
    () => waitlistHashesFromCsv("email,muxWaitlistJoinedAt\nhello@example.com,"),
    /no existing/,
  );
  assert.throws(
    () => waitlistHashesFromCsv("email,muxWaitlistJoinedAt\nhello@example.com,invalid"),
    /invalid waitlist/,
  );
  assert.throws(() => waitlistHashesFromCsv('email,muxWaitlistJoinedAt\n"unclosed'), /unclosed/);
});

test("the seed RPC imports hashes without sending email or Slack messages", async () => {
  const hashes = [waitlistEmailHash("old@example.com"), waitlistEmailHash("new@example.com")];
  const total = await seedWaitlistLeadNumbers(hashes, env, async (url, options) => {
    assert.equal(url, "https://counter.supabase.co/rest/v1/rpc/sidequest_seed_waitlist_leads");
    assert.deepEqual(JSON.parse(options.body), { p_email_hashes: hashes });
    return Response.json(2);
  });
  assert.equal(total, 2);
});

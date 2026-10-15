import { test } from "node:test";
import assert from "node:assert/strict";
import { getAuthOrigin, authMessages, getAuthErrorMessage, getCallbackUrl } from "../src/lib/auth-policy.ts";
import { getSupabaseConfig, isGoogleSignInAvailable } from "../src/lib/supabase/config.ts";
import { requestEmailSignIn } from "../src/lib/email-sign-in.ts";

function withEnv(values, run) {
  const before = { ...process.env };
  try {
    for (const key of ["NODE_ENV", "NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) delete process.env[key];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
}

test("production callbacks cannot be redirected to a request-controlled origin", () => {
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://mux.example/" }, () => {
    for (const origin of ["https://attacker.example", "http://localhost:3000", "javascript:alert(1)", "https://mux.example.attacker.example"]) {
      assert.equal(getAuthOrigin(origin), "https://mux.example");
    }
  });
});
test("development accepts a local HTTP origin on any port", () => {
  withEnv({ NODE_ENV: "development" }, () => {
    assert.equal(getAuthOrigin("http://localhost:3000"), "http://localhost:3000");
    assert.equal(getAuthOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
    assert.equal(getAuthOrigin("http://localhost:3001"), "http://localhost:3001");
    for (const origin of ["http://localhost.attacker.example:3000", "file:///tmp", "https://attacker.example"]) {
      assert.equal(getAuthOrigin(origin), "https://getsidequest.dev");
    }
  });
});
test("production callbacks require HTTPS and support Vercel's production domain", () => {
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://mux.example" }, () => assert.throws(() => getAuthOrigin(), /HTTPS/));
  withEnv({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "mux-landing.vercel.app" }, () => assert.equal(getAuthOrigin(), "https://mux-landing.vercel.app"));
});
test("missing Supabase configuration leaves sign-in unavailable", () => {
  withEnv({}, () => assert.equal(getSupabaseConfig(), null));
});
test("Supabase accepts public keys and rejects privileged keys", () => {
  const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }, () => assert.ok(getSupabaseConfig()));
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }, () => assert.ok(getSupabaseConfig()));
  for (const key of ["sb_secret_test", jwt("service_role"), "malformed"]) {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }, () => assert.throws(() => getSupabaseConfig(), /publishable/));
  }
});
test("Supabase requires HTTPS except for a local project outside production", () => {
  const key = "sb_publishable_test";
  const config = (NODE_ENV, url) => ({ NODE_ENV, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
  withEnv(config("development", "http://127.0.0.1:54321"), () => assert.ok(getSupabaseConfig()));
  withEnv(config("development", "http://localhost:54321"), () => assert.ok(getSupabaseConfig()));
  for (const [env, url] of [["production", "http://localhost:54321"], ["development", "http://project.supabase.co"], ["development", "http://localhost.attacker.example"]]) {
    withEnv(config(env, url), () => assert.throws(() => getSupabaseConfig(), /HTTPS/));
  }
});
test("the sign-in UI only exposes defined error messages", () => {
  assert.equal(getAuthErrorMessage(undefined), "");
  assert.match(getAuthErrorMessage("cancelled"), /cancelled/);
  for (const error of ["<script>alert(1)</script>", "__proto__", "constructor", "toString", ["cancelled", "callback"]]) {
    assert.equal(getAuthErrorMessage(error), authMessages.callback);
  }
});

test("Google sign-in only becomes available when Supabase enables the provider", async () => {
  const config = { url: "https://project.supabase.co", key: "sb_publishable_test" };
  for (const enabled of [true, false, "true", undefined]) {
    const result = await isGoogleSignInAvailable(config, async (url, options) => {
      assert.equal(url, "https://project.supabase.co/auth/v1/settings");
      assert.equal(options.headers.apikey, config.key);
      assert.equal(options.cache, "no-store");
      return Response.json({ external: { google: enabled } });
    });
    assert.equal(result, enabled === true);
  }
  assert.equal(await isGoogleSignInAvailable(null, () => { throw new Error("Must not request without configuration"); }), false);
  assert.equal(await isGoogleSignInAvailable(config, async () => new Response("Unavailable", { status: 503 })), false);
  assert.equal(await isGoogleSignInAvailable(config, async () => { throw new Error("Network unavailable"); }), false);
  assert.equal(await isGoogleSignInAvailable(config, async () => new Response("Invalid JSON")), false);
});

test("email links support both new and existing accounts and use the app callback", async () => {
  const calls = [];
  const result = await requestEmailSignIn("  Person+Mux@Example.com  ", {
    signInWithOtp: async credentials => { calls.push(credentials); return { error: null }; },
  }, "https://mux.example");
  assert.deepEqual(calls, [{ email: "person+mux@example.com", options: { shouldCreateUser: true, emailRedirectTo: "https://mux.example/auth/callback" } }]);
  assert.equal(result.sent, true);
  assert.equal(result.error, "");
  assert.equal(result.retryAfter, 60);
});

test("sign-in destinations map to fixed callback paths", () => {
  assert.equal(getCallbackUrl("https://mux.example"), "https://mux.example/auth/callback");
  assert.equal(getCallbackUrl("https://mux.example", "connect"), "https://mux.example/auth/callback/connect");
  for (const destination of ["account", "https://attacker.example", "/connect", null]) {
    assert.equal(getCallbackUrl("https://mux.example", destination), "https://mux.example/auth/callback");
  }
});

test("invalid email inputs never reach the email provider", async () => {
  const auth = { signInWithOtp: async () => { throw new Error("Must not send"); } };
  for (const value of [null, new Blob(["email@example.com"]), "", "person", "a@@example.com", "a@example..com", "a@example.com\r\nBcc: other@example.com", `${"a".repeat(65)}@example.com`, `a@${"b".repeat(250)}.com`]) {
    const result = await requestEmailSignIn(value, auth, "https://mux.example");
    assert.equal(result.sent, false);
    assert.equal(result.error, "Enter a valid email address.");
  }
});

test("email service errors do not expose account or provider details", async () => {
  const missing = await requestEmailSignIn("person@example.com", null, "https://mux.example");
  assert.equal(missing.sent, false);
  assert.match(missing.error, /unavailable/);
  for (const code of ["email_address_not_authorized", "user_not_found", "signup_disabled", "unexpected_failure"]) {
    const result = await requestEmailSignIn("person@example.com", {
      signInWithOtp: async () => ({ error: { code, message: "Private provider details" } }),
    }, "https://mux.example");
    assert.equal(result.sent, false);
    assert.equal(result.error, "We could not send the sign-in link. Try again or continue with Google.");
  }
  const failed = await requestEmailSignIn("person@example.com", { signInWithOtp: async () => { throw new Error("Private network details"); } }, "https://mux.example");
  assert.equal(failed.sent, false);
  assert.doesNotMatch(failed.error, /Private/);
});

test("email provider rate limits return a cooldown and never a sent state", async () => {
  for (const error of [{ status: 429 }, { code: "over_email_send_rate_limit" }, { code: "over_request_rate_limit" }]) {
    const result = await requestEmailSignIn("person@example.com", { signInWithOtp: async () => ({ error }) }, "https://mux.example");
    assert.equal(result.sent, false);
    assert.equal(result.retryAfter, 60);
    assert.match(result.error, /wait a minute/);
  }
});

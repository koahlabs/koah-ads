type Signup = { email: string; joinedAt: string };
type Environment = { LOOPS_API_KEY?: string; SETTINGS__KOAH_INFO_SLACK_URL?: string };
const inFlight = new Map<string, Promise<void>>();
const API = "https://app.loops.so/api/v1";

// This module is imported only by the server route. Never expose the webhook
// to the browser or include it in logs.
export async function notifyWaitlistSignup(signup: Signup, env: Environment, fetcher: typeof fetch = fetch) {
  if (!env.LOOPS_API_KEY || !env.SETTINGS__KOAH_INFO_SLACK_URL) return;
  const active = inFlight.get(signup.email);
  if (active) return active;
  const task = deliver(signup, env, fetcher);
  inFlight.set(signup.email, task);
  try { await task; }
  finally { inFlight.delete(signup.email); }
}

async function deliver(signup: Signup, env: Environment, fetcher: typeof fetch) {
  try {
    const webhook = new URL(env.SETTINGS__KOAH_INFO_SLACK_URL!);
    if (webhook.protocol !== "https:" || webhook.hostname !== "hooks.slack.com" || !webhook.pathname.startsWith("/services/") || webhook.username || webhook.password) {
      console.error("Sidequest waitlist: invalid Slack webhook configuration");
      return;
    }
    const call = (path: string, method = "GET", data?: object) => fetcher(`${API}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    // Recheck persisted state because a previous request may already have sent it.
    const found = await call(`contacts/find?email=${encodeURIComponent(signup.email)}`);
    if (!found.ok) { console.error("Sidequest waitlist: Slack contact lookup failed", found.status); return; }
    const contacts = await found.json();
    if (!Array.isArray(contacts)) { console.error("Sidequest waitlist: invalid Slack contact lookup"); return; }
    if (contacts[0]?.muxWaitlistSlackNotified !== false) return;

    const sent = await fetcher(webhook.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Plain text prevents addresses from creating Slack markup or mentions.
      body: JSON.stringify({
        text: `⚔️ Sidequest — new waitlist signup\n📧 Email: ${signup.email}\n🗓️ Joined: ${signup.joinedAt}`,
        mrkdwn: false,
        unfurl_links: false,
        unfurl_media: false,
      }),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!sent.ok || (await sent.text()).trim() !== "ok") {
      console.error("Sidequest waitlist: Slack delivery failed", sent.status);
      return;
    }
    // Retry marker writes, not the Slack POST: a lost response can mean that
    // Slack accepted a message, and incoming webhooks have no idempotency key.
    for (const delay of [0, 250, 750]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const marked = await call("contacts/update", "PUT", { email: signup.email, muxWaitlistSlackNotified: true });
        if (marked.ok && (await marked.json()).success === true) return;
      } catch { /* Retry transient marker failures without exposing details. */ }
    }
    console.error("Sidequest waitlist: Slack delivery marker save failed after retries");
  } catch {
    // Neither provider responses nor exception messages are safe to log.
    console.error("Sidequest waitlist: Slack notification request failed");
  }
}

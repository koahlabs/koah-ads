import { createHmac } from "node:crypto";

type Environment = { LOOPS_API_KEY?: string; LOOPS_WAITLIST_TRANSACTIONAL_ID?: string; LOOPS_WAITLIST_MAILING_LIST_ID?: string };
type Contact = { muxWaitlistJoinedAt?: string; muxWaitlistWelcomeSent?: boolean; muxWaitlistSlackNotified?: boolean };
type Signup = { email: string; joinedAt: string };
const attempts = new Map<string, { count: number; expires: number }>();
const API = "https://app.loops.so/api/v1";
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type Call = (path: string, method?: string, data?: object) => Promise<Response>;

async function markWelcomeSent(call: Call, email: string) {
  for (const wait of [0, 250, 750]) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const marked = await call("contacts/update", "PUT", { email, muxWaitlistWelcomeSent: true });
      const result = await marked.json();
      if (marked.ok && result?.success === true) return true;
    } catch { /* A rejected or unreadable response counts as a failed attempt. */ }
  }
  return false;
}

export async function handleWaitlist(request: Request, env: Environment, fetcher: typeof fetch = fetch, onSignup?: (signup: Signup) => void) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ message: "Please use the signup form on this site." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ message: "Send a valid signup request." }, 415);
  // Bound the body while reading, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply({ message: "Enter your email address." }, 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return reply({ message: "The signup request is too large." }, 413); }
      chunks.push(value);
    }
  } catch { return reply({ message: "Send a valid signup request." }, 400); }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch { return reply({ message: "Send a valid signup request." }, 400); }
  if (body.website) return reply({ message: "Unable to accept this signup." }, 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email) || email.split("@")[0].length > 64) return reply({ message: "Enter a valid email address." }, 400);
  if (body.consent !== true) return reply({ message: "Agree to receive Sidequest email updates to join." }, 400);
  const { LOOPS_API_KEY: apiKey, LOOPS_WAITLIST_TRANSACTIONAL_ID: transactionalId } = env;
  if (!apiKey || !transactionalId) return reply({ message: "Signups are not open yet. Please try again soon." }, 503);

  // Per-instance abuse limit. Use an edge/WAF limit for distributed deployments.
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  // Vercel sets x-real-ip and overwrites x-forwarded-for with the client address,
  // so a client cannot pick its own key. Elsewhere, put a trusted proxy in front.
  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const clientKey = createHmac("sha256", apiKey).update(ip).digest("hex");
  const attempt = attempts.get(clientKey) || { count: 0, expires: now + 600000 };
  if (attempt.count >= 8 || attempts.size >= 5000) return reply({ message: "Too many attempts. Please try again in ten minutes." }, 429);
  attempt.count++;
  attempts.set(clientKey, attempt);

  const signal = AbortSignal.timeout(20000);
  const call = (path: string, method = "GET", data?: object, extraHeaders?: Record<string, string>) => fetcher(`${API}/${path}`, {
    method, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
    body: data ? JSON.stringify(data) : undefined, cache: "no-store", signal,
  });
  let saved = false;
  try {
    const found = await call(`contacts/find?email=${encodeURIComponent(email)}`);
    if (!found.ok) throw new Error(`Contact lookup: ${found.status}`);
    const contacts: Contact[] = await found.json();
    if (!Array.isArray(contacts)) throw new Error("Invalid contact lookup response");
    const existing = contacts[0];
    const joinedAt = existing?.muxWaitlistJoinedAt || new Date().toISOString();
    const newSignup = !existing?.muxWaitlistJoinedAt;
    const savedContact = await call("contacts/update", "PUT", {
      email,
      muxWaitlistJoinedAt: joinedAt,
      ...(newSignup && onSignup ? { muxWaitlistSlackNotified: false } : {}),
      ...(!existing ? { source: "mux-waitlist" } : {}),
      ...(env.LOOPS_WAITLIST_MAILING_LIST_ID ? { mailingLists: { [env.LOOPS_WAITLIST_MAILING_LIST_ID]: true } } : {}),
      // Do not overwrite existing contacts' global subscription preferences.
    });
    const savedResult = await savedContact.json();
    if (!savedContact.ok || savedResult.success !== true) throw new Error(`Contact save: ${savedContact.status}`);
    saved = true;
    // Schedule notification as soon as storage succeeds, even if welcome mail fails.
    // Only new members and explicitly pending notifications qualify; old contacts
    // without a notification marker must not produce a backlog of Slack messages.
    if (onSignup && (newSignup || existing?.muxWaitlistSlackNotified === false)) {
      try { onSignup({ email, joinedAt }); }
      catch { console.error("Sidequest waitlist: Slack notification scheduling failed"); }
    }
    if (existing?.muxWaitlistWelcomeSent === true) return reply({ success: true, emailSent: false });
    const idempotencyKey = createHmac("sha256", apiKey).update(`mux-welcome-v1:${transactionalId}:${email}`).digest("hex");
    const sent = await call("transactional", "POST", { email, transactionalId, addToAudience: false }, { "Idempotency-Key": idempotencyKey });
    const sentResult = await sent.json();
    // A conflict for a different payload is an error, never a successful send.
    const duplicate = sent.status === 409 && /idempotency/i.test(sentResult.message || "") && !/different|in.progress/i.test(sentResult.message || "");
    if ((!sent.ok || sentResult.success !== true) && !duplicate) throw new Error(`Welcome send: ${sent.status}`);
    // The email is sent: from here on a failure must never report it as unsent.
    // The marker is what stops a second welcome after Loops' 24-hour idempotency
    // window, so retry it before giving up.
    if (!await markWelcomeSent(call, email)) console.error("Sidequest waitlist: welcome marker save failed after retries");
    return reply({ success: true, emailSent: !duplicate });
  } catch (error) {
    // Never log email addresses, provider bodies, or API keys.
    console.error("Sidequest waitlist:", error instanceof Error && /^(Contact|Welcome)/.test(error.message) ? error.message : "Provider request failed");
    return reply({ message: saved ? "We saved your place, but couldn’t send your email. Please try again." : "We couldn’t save your place. Please try again." }, 502);
  }
}

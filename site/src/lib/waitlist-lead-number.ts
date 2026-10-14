import { createHash } from "node:crypto";

export type WaitlistCounterEnvironment = { NEXT_PUBLIC_SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string };

export function waitlistEmailHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function callCounter(operation: "sidequest_register_waitlist_lead" | "sidequest_seed_waitlist_leads", body: object, env: WaitlistCounterEnvironment, fetcher: typeof fetch): Promise<number | null> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_")) return null;
  try {
    const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || !["", "/"].includes(base.pathname)) return null;
    const response = await fetcher(`${base.origin}/rest/v1/rpc/${operation}`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    return typeof number === "number" && Number.isSafeInteger(number) && number >= 0 ? number : null;
  } catch {
    return null;
  }
}

export async function getWaitlistLeadNumber(email: string, env: WaitlistCounterEnvironment, fetcher: typeof fetch = fetch) {
  const value = await callCounter("sidequest_register_waitlist_lead", { p_email_hash: waitlistEmailHash(email) }, env, fetcher);
  return value !== null && value > 0 ? value : null;
}

export function seedWaitlistLeadNumbers(emailHashes: string[], env: WaitlistCounterEnvironment, fetcher: typeof fetch = fetch) {
  return callCounter("sidequest_seed_waitlist_leads", { p_email_hashes: emailHashes }, env, fetcher);
}

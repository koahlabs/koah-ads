import { isLocalHttp } from "../auth-policy.ts";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // These are public project keys. Service-role and secret keys must never be used here.
  if (key.startsWith("sb_secret_")) throw new Error("Use a Supabase publishable key for sign-in.");
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
      if (payload.role !== "anon") throw new Error("Unexpected API key role.");
    } catch {
      throw new Error("Use a Supabase publishable or anon key for sign-in.");
    }
  }
  const parsed = new URL(url);
  const local = process.env.NODE_ENV !== "production" && isLocalHttp(parsed);
  if (parsed.protocol !== "https:" && !local) throw new Error("The Supabase project URL must use HTTPS.");
  return { url, key };
}

export async function isGoogleSignInAvailable(
  config = getSupabaseConfig(),
  fetcher: typeof fetch = fetch,
) {
  if (!config) return false;
  try {
    const response = await fetcher(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}

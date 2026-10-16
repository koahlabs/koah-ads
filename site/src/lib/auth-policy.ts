export const authMessages: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. You can try again.",
  callback: "We could not finish signing you in. Please try again.",
  provider: "Google sign-in is unavailable right now. Please try again.",
  session: "Your session has ended. Please sign in again.",
  invite_only: "Sidequest is invite-only for now.",
  link: "This sign-in link has expired or was already used. Request a new link below.",
};

export function getAuthErrorMessage(error: string | string[] | undefined) {
  if (error === undefined) return "";
  if (typeof error !== "string" || !Object.hasOwn(authMessages, error)) return authMessages.callback;
  return authMessages[error];
}

export function canSignIn(email: string | null | undefined, signInOpen: boolean) {
  return signInOpen || !!email?.toLowerCase().endsWith("@koahlabs.com");
}

export type AuthDestination = "account" | "connect";

export function getCallbackUrl(origin: string, destination?: unknown) {
  return `${origin}/auth/callback${destination === "connect" ? "/connect" : ""}`;
}

export function isLocalHttp(url: URL) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
}

export function getAuthOrigin(requestOrigin?: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://getsidequest.dev");
  const productionOrigin = new URL(site).origin;
  // Local development must return to this browser's local app, not the live website.
  if (process.env.NODE_ENV !== "production" && requestOrigin) {
    try {
      const local = new URL(requestOrigin);
      if (isLocalHttp(local)) return local.origin;
    } catch { /* Use the configured site origin below. */ }
  }
  if (!productionOrigin.startsWith("https://")) throw new Error("The production site URL must use HTTPS.");
  return productionOrigin;
}

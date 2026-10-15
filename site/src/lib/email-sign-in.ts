import { getCallbackUrl } from "./auth-policy.ts";

export type EmailSignInState = {
  error: string;
  email: string;
  sent: boolean;
  retryAfter: number;
};

type EmailAuth = {
  signInWithOtp: (credentials: {
    email: string;
    options: { shouldCreateUser: boolean; emailRedirectTo: string };
  }) => Promise<{ error: { code?: string; status?: number } | null }>;
};

const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export async function requestEmailSignIn(value: unknown, auth: EmailAuth | null, origin: string, destination?: unknown): Promise<EmailSignInState> {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  const state = { error: "", email, sent: false, retryAfter: 0 };
  if (email.length > 254 || email.split("@")[0].length > 64 || !emailPattern.test(email)) {
    return { ...state, error: "Enter a valid email address." };
  }
  if (!auth) return { ...state, error: "Email sign-in is unavailable right now. Please try again later." };
  try {
    const { error } = await auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: getCallbackUrl(origin, destination) },
    });
    if (!error) return { ...state, sent: true, retryAfter: 60 };
    if (error.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code || "")) {
      return { ...state, error: "Too many requests. Please wait a minute before trying again.", retryAfter: 60 };
    }
  } catch { /* Keep email service details and account information out of the UI. */ }
  return { ...state, error: "We could not send the sign-in link. Try again or continue with Google." };
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthOrigin } from "@/lib/auth-policy";
import { isGoogleSignInAvailable } from "@/lib/supabase/config";
import { requestEmailSignIn, type EmailSignInState } from "@/lib/email-sign-in";
import { signInEnabled } from "@/lib/feature-flags";

export type AuthFormState = { error: string };

export async function signInWithEmail(_previous: EmailSignInState, formData: FormData): Promise<EmailSignInState> {
  if (!await signInEnabled()) return { error: "Sign-in is not available right now.", email: "", sent: false, retryAfter: 0 };
  const requestHeaders = await headers();
  const origin = getAuthOrigin(requestHeaders.get("origin") || undefined);
  const supabase = await createClient();
  return requestEmailSignIn(formData.get("email"), supabase?.auth || null, origin);
}

export async function signInWithGoogle(): Promise<AuthFormState> {
  if (!await signInEnabled()) return { error: "Sign-in is not available right now." };
  const supabase = await createClient();
  if (!supabase) return { error: "Sign-in is not available yet. Please try again later." };
  if (!await isGoogleSignInAvailable()) return { error: "Google sign-in is unavailable right now. Please try again." };
  const requestHeaders = await headers();
  const origin = getAuthOrigin(requestHeaders.get("origin") || undefined);
  let providerUrl: string | undefined;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (!error && data.url) providerUrl = data.url;
  } catch { /* Show a retry state without exposing provider details. */ }
  if (!providerUrl) return { error: "Google sign-in is unavailable right now. Please try again." };
  redirect(providerUrl);
}

export async function signOut(): Promise<AuthFormState> {
  const supabase = await createClient();
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) return { error: "We could not sign you out. Please try again." };
    } catch {
      return { error: "We could not sign you out. Please try again." };
    }
  }
  redirect(await signInEnabled() ? "/sign-in" : "/");
}

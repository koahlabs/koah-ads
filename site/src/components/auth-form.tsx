"use client";

import { useActionState } from "react";
import { signInWithGoogle, signOut } from "@/app/auth/actions";
import type { AuthDestination } from "@/lib/auth-policy";
import { GoogleLogo } from "@/components/google-logo";

export function AuthForm({
  mode,
  available = true,
  initialError = "",
  destination = "account",
}: {
  mode: "sign-in" | "sign-out";
  available?: boolean;
  initialError?: string;
  destination?: AuthDestination;
}) {
  const [state, action, pending] = useActionState(mode === "sign-in" ? signInWithGoogle : signOut, {
    error: initialError,
  });
  const signingIn = mode === "sign-in";
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      {signingIn && <input type="hidden" name="destination" value={destination} />}
      <button type="submit" className="auth-button" disabled={pending || !available}>
        {signingIn && <GoogleLogo />}
        <span>
          {pending
            ? signingIn
              ? "Connecting…"
              : "Signing out…"
            : signingIn
              ? "Continue with Google"
              : "Sign out"}
        </span>
      </button>
      <div className="auth-feedback" aria-live="polite">
        {(state.error || !available) && (
          <p role="alert">{state.error || "Google sign-in is off. Use your email."}</p>
        )}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { signInWithGoogle, signOut } from "@/app/auth/actions";
import { GoogleLogo } from "@/components/google-logo";

export function AuthForm({ mode, available = true, initialError = "" }: { mode: "sign-in" | "sign-out"; available?: boolean; initialError?: string }) {
  const [state, action, pending] = useActionState(mode === "sign-in" ? signInWithGoogle : signOut, { error: initialError });
  const signingIn = mode === "sign-in";
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <button type="submit" className="auth-button" disabled={pending || !available}>
        {signingIn && <GoogleLogo />}
        <span>{pending ? (signingIn ? "Connecting…" : "Signing out…") : (signingIn ? "Continue with Google" : "Sign out")}</span>
      </button>
      <div className="auth-feedback" aria-live="polite">
        {(state.error || !available) && <p role="alert">{state.error || "Sign-in is not available yet. Please try again later."}</p>}
      </div>
    </form>
  );
}

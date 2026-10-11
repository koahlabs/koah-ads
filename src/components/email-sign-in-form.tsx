"use client";

import { useActionState, useEffect, useState } from "react";
import { signInWithEmail } from "@/app/auth/actions";
import type { EmailSignInState } from "@/lib/email-sign-in";

const initialState: EmailSignInState = { error: "", email: "", sent: false, retryAfter: 0 };

export function EmailSignInForm({ available, initialError = "" }: { available: boolean; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [state, action, pending] = useActionState(async (previous: EmailSignInState, formData: FormData) => {
    const result = await signInWithEmail(previous, formData);
    setRemaining(result.retryAfter);
    return result;
  }, { ...initialState, error: initialError });

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  const sentToThisEmail = state.sent && email.trim().toLowerCase() === state.email;
  return (
    <form action={action} className="auth-form email-sign-in-form" aria-busy={pending}>
      <label htmlFor="sign-in-email">Email address</label>
      <input
        id="sign-in-email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        required
        maxLength={254}
        value={email}
        onChange={event => setEmail(event.target.value)}
        disabled={pending || !available}
        aria-describedby="email-sign-in-feedback"
      />
      <button type="submit" className="auth-button auth-button-primary" disabled={pending || !available || remaining > 0}>
        {pending ? "Sending…" : remaining > 0 ? `Send again in ${remaining}s` : sentToThisEmail ? "Send another link" : "Email me a sign-in link"}
      </button>
      <div id="email-sign-in-feedback" className="auth-feedback email-sign-in-feedback" aria-live="polite" aria-atomic="true">
        {state.error ? <p role="alert">{state.error}</p> : sentToThisEmail ? <p className="auth-success">Check your email for your sign-in link.</p> : !available ? <p>Email sign-in is unavailable right now.</p> : null}
      </div>
    </form>
  );
}

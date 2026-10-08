"use client";

import { useRef, useState, type FormEvent } from "react";
import { SOCIAL_URL } from "@/lib/brand";
import { Icon } from "@/components/icon";

type Result = { success?: boolean; message?: string; emailSent?: boolean };

export function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setStatus("submitting");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), website: data.get("website"), consent: true }),
        signal: AbortSignal.timeout(25000),
      });
      const result: Result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setEmailSent(Boolean(result.emailSent));
      setStatus("success");
    } catch {
      setMessage("We couldn’t connect. Please try again.");
      setStatus("error");
    } finally {
      submitting.current = false;
    }
  }
  if (status === "success") {
    return (
      <div className="waitlist-form waitlist-success" role="status">
        <h2><Icon name="check" size={20} />You’re on the list.</h2>
        <p>{emailSent ? "Check your inbox for a note from mux." : "We’ll email you when early access opens."}</p>
        <a href={SOCIAL_URL} target="_blank" rel="noopener noreferrer">
          Follow @guard_if for updates <Icon name="arrow-up-right" />
        </a>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="waitlist-form" aria-label="Join the mux waitlist" aria-busy={status === "submitting"}>
      <label className="sr-only" htmlFor="waitlist-email">Email address</label>
      <div className="form-row">
        <input id="waitlist-email" name="email" type="email" placeholder="Your email address" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-describedby={status === "error" ? "waitlist-error waitlist-consent" : "waitlist-consent"} disabled={status === "submitting"} />
        <button type="submit" className="button" disabled={status === "submitting"}>{status === "submitting" ? "Joining…" : "Join the waitlist"}</button>
      </div>
      <div className="honeypot" aria-hidden="true"><label htmlFor="waitlist-website">Website</label><input id="waitlist-website" name="website" type="text" tabIndex={-1} autoComplete="off" /></div>
      <p id="waitlist-consent" className="form-note">Join for early access and mux email updates. Unsubscribe anytime.</p>
      <div className="form-feedback">
        {status === "error" && <p id="waitlist-error" className="form-error" role="alert">{message}</p>}
      </div>
    </form>
  );
}

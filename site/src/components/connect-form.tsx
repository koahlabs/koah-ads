"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { confirmCode, lookupCode } from "@/app/connect/actions";
import { AuthForm } from "@/components/auth-form";
import { Icon } from "@/components/icon";
import type { LookupState } from "@/lib/connect-server";
import { describeDevice, formatAgo } from "@/lib/dashboard";
import {
  formatUserCode,
  normalizeUserCode,
  USER_CODE_LENGTH,
  userCodeLetters,
} from "@/lib/user-code";
import { useNow } from "@/lib/use-live";

const emptyLookup: LookupState = { message: "", request: null };

export function ConnectForm({
  email,
  linked = emptyLookup,
}: {
  email: string;
  linked?: LookupState;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <CodeEntry
      key={attempt}
      email={email}
      linked={attempt === 0 ? linked : emptyLookup}
      onCancel={() => setAttempt(attempt + 1)}
    />
  );
}

function CodeEntry({
  email,
  linked,
  onCancel,
}: {
  email: string;
  linked: LookupState;
  onCancel: () => void;
}) {
  const [lookup, lookupAction, looking] = useActionState(lookupCode, linked);
  const [confirm, confirmAction, confirming] = useActionState(confirmCode, {
    message: "",
    connected: false,
  });
  const [code, setCode] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const now = useNow();
  const { request } = lookup;
  const message = confirm.message || lookup.message;

  useEffect(() => {
    if (!confirm.connected) return;
    const timer = window.setTimeout(() => router.replace("/account"), 2000);
    return () => window.clearTimeout(timer);
  }, [confirm.connected, router]);

  function typeCode(input: string) {
    const letters = userCodeLetters(input).slice(0, USER_CODE_LENGTH);
    setCode(formatUserCode(letters));
    if (normalizeUserCode(letters)) form.current?.requestSubmit();
  }

  return (
    <section className="connect-card" aria-labelledby="connect-heading">
      {confirm.connected ? (
        <div className="connect-success" role="status">
          <Icon name="check" size={48} />
          <h1 id="connect-heading">Connected.</h1>
          <p>Taking you to your dashboard…</p>
        </div>
      ) : (
        <>
          <header className="connect-head">
            <h1 id="connect-heading">Connect this computer.</h1>
            <div className="connect-account">
              <span className="dashboard-avatar" aria-hidden="true">
                {email.charAt(0).toUpperCase()}
              </span>
              <span className="connect-email">{email}</span>
            </div>
            <div className="connect-switch">
              <span>Not you?</span>
              <AuthForm mode="sign-out" />
            </div>
          </header>
          {request ? (
            <form action={confirmAction} aria-busy={confirming}>
              <input type="hidden" name="code" value={request.code} />
              <p className="connect-code">{formatUserCode(request.code)}</p>
              <p className="connect-hint">Check that Claude Code shows this code.</p>
              <dl id="connect-details" className="connect-details">
                {request.os && (
                  <div>
                    <dt>Computer</dt>
                    <dd>{describeDevice({ location: null, os: request.os })}</dd>
                  </div>
                )}
                {request.location && (
                  <div>
                    <dt>Location</dt>
                    <dd>{request.location}</dd>
                  </div>
                )}
                <div>
                  <dt>Requested</dt>
                  <dd>
                    <span suppressHydrationWarning>{formatAgo(request.requestedAt, now)}</span>
                  </dd>
                </div>
                <div>
                  <dt>Network</dt>
                  {request.differentNetwork ? (
                    <dd className="connect-warning">
                      <Icon name="info" />
                      <span>
                        This request came from a different network than this browser. Only continue
                        if you started it yourself.
                      </span>
                    </dd>
                  ) : (
                    <dd className="connect-same-network">
                      <Icon name="check" />
                      <span>Same network as this browser</span>
                    </dd>
                  )}
                </div>
              </dl>
              <details className="connect-technical">
                <summary>
                  Technical details
                  <Icon name="caret-down" size={12} />
                </summary>
                <dl className="connect-details">
                  <div>
                    <dt>Computer IP</dt>
                    <dd>{request.ip}</dd>
                  </div>
                  <div>
                    <dt>Browser IP</dt>
                    <dd>{request.visitorIp ?? "unknown"}</dd>
                  </div>
                </dl>
              </details>
              <div className="connect-actions">
                <button
                  type="submit"
                  className="auth-button auth-button-primary"
                  disabled={confirming}
                  aria-describedby="connect-details"
                >
                  <span>{confirming ? "Connecting…" : "Connect"}</span>
                </button>
                <button
                  type="button"
                  className="auth-button connect-cancel"
                  disabled={confirming}
                  onClick={onCancel}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="connect-hint">
                Enter the code from /sidequest-connect. Never use a code someone else sent you.
              </p>
              <form
                ref={form}
                action={lookupAction}
                className="auth-form email-sign-in-form"
                aria-busy={looking}
              >
                <label htmlFor="connect-code">Code</label>
                <input
                  id="connect-code"
                  name="code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="XXXX-XXXX"
                  required
                  autoFocus
                  readOnly={looking}
                  value={code}
                  onChange={(event) => typeCode(event.target.value)}
                  aria-describedby="connect-feedback"
                />
                <button
                  type="submit"
                  className="auth-button auth-button-primary"
                  disabled={looking}
                >
                  <span>{looking ? "Checking…" : "Continue"}</span>
                </button>
              </form>
            </>
          )}
          <div id="connect-feedback" className="auth-feedback" aria-live="polite">
            {message && <p>{message}</p>}
          </div>
        </>
      )}
    </section>
  );
}

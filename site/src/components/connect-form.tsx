"use client";

import { useActionState, useRef, useState } from "react";
import { confirmCode, lookupCode } from "@/app/connect/actions";
import { formatUserCode, normalizeUserCode, USER_CODE_LENGTH, userCodeLetters } from "@/lib/user-code";

export function ConnectForm() {
  const [attempt, setAttempt] = useState(0);
  return <CodeEntry key={attempt} onCancel={() => setAttempt(attempt + 1)} />;
}

function CodeEntry({ onCancel }: { onCancel: () => void }) {
  const [lookup, lookupAction, looking] = useActionState(lookupCode, { message: "", request: null });
  const [confirm, confirmAction, confirming] = useActionState(confirmCode, { message: "", connected: false });
  const [code, setCode] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const { request } = lookup;
  const message = confirm.message || lookup.message;

  function typeCode(input: string) {
    const letters = userCodeLetters(input).slice(0, USER_CODE_LENGTH);
    setCode(formatUserCode(letters));
    if (normalizeUserCode(letters)) form.current?.requestSubmit();
  }

  return (
    <>
      {confirm.connected ? null : request ? (
        <form action={confirmAction} className="auth-form" aria-busy={confirming}>
          <input type="hidden" name="code" value={request.code} />
          <p className="connect-code-label">Code</p>
          <p className="connect-code">{formatUserCode(request.code)}</p>
          <dl id="connect-details" className="connect-details">
            <dt>Requested</dt>
            <dd>{new Date(request.requestedAt).toLocaleString()}</dd>
            {request.location && <><dt>Location</dt><dd>{request.location}</dd></>}
            <dt>Computer IP</dt>
            <dd>{request.ip}</dd>
            <dt>This browser&rsquo;s IP</dt>
            <dd>{request.visitorIp ?? "unknown"}</dd>
          </dl>
          {request.differentNetwork && <p id="connect-notice" className="connect-notice" role="note">This request came from a different network than this browser. Only continue if you started it yourself.</p>}
          <div className="connect-actions">
            <button type="submit" className="auth-button auth-button-primary" disabled={confirming} aria-describedby={request.differentNetwork ? "connect-details connect-notice" : "connect-details"}>
              <span>{confirming ? "Connecting…" : "Connect this computer"}</span>
            </button>
            <button type="button" className="auth-button" disabled={confirming} onClick={onCancel} autoFocus>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p>Enter the code shown in Claude Code after running /sidequest-connect. Never enter a code someone else sent you.</p>
          <form ref={form} action={lookupAction} className="auth-form email-sign-in-form" aria-busy={looking}>
            <label htmlFor="connect-code">Code</label>
            <input id="connect-code" name="code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX" required autoFocus readOnly={looking} value={code} onChange={event => typeCode(event.target.value)} aria-describedby="connect-feedback" />
            <button type="submit" className="auth-button auth-button-primary" disabled={looking}>
              <span>{looking ? "Checking…" : "Continue"}</span>
            </button>
          </form>
        </>
      )}
      <div id="connect-feedback" className="auth-feedback" aria-live="polite">
        {message && <p role={confirm.connected ? undefined : "alert"} className={confirm.connected ? "auth-success" : undefined}>{message}</p>}
      </div>
    </>
  );
}

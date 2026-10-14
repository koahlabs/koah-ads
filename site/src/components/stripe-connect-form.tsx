"use client";

import { useActionState, useState } from "react";
import { connectStripe } from "@/app/account/actions";
import { Icon } from "@/components/icon";
import type { StripeStatus } from "@/lib/dashboard";

export function StripeConnectForm({ status, eligible, countries, preview = false }: { status: StripeStatus; eligible: boolean; countries: string[]; preview?: boolean }) {
  const [state, action, pending] = useActionState(connectStripe, { error: "" });
  const [previewMessage, setPreviewMessage] = useState("");
  const existing = status === "connected" || status === "incomplete";
  const disabled = !existing && (!eligible || status === "unavailable");
  const label = status === "connected" ? "Manage in Stripe" : status === "incomplete" ? "Finish Stripe setup" : "Connect Stripe";
  const names = new Intl.DisplayNames("en", { type: "region" });
  return (
    <form action={preview ? undefined : action} className="stripe-connect-form" aria-busy={pending} onSubmit={preview ? event => { event.preventDefault(); setPreviewMessage("This is a design preview. Stripe opens from your signed-in account."); } : undefined}>
      {!existing && eligible && status !== "unavailable" && (
        <div className="stripe-country">
          <label htmlFor="stripe-country">Country of residence</label>
          <select id="stripe-country" name="country" required defaultValue="" disabled={pending}>
            <option value="" disabled>Select country</option>
            {countries.map(country => <option value={country} key={country}>{names.of(country) || country}</option>)}
          </select>
        </div>
      )}
      <button type="submit" className="dashboard-button stripe-connect-button" disabled={disabled || pending} aria-describedby="stripe-help stripe-feedback">
        {disabled && <Icon name="lock" size={14} />}
        <span>{label}</span>
        {pending ? <span className="dashboard-spinner" aria-label="Connecting…" /> : !disabled && <Icon name="arrow-up-right" size={14} />}
      </button>
      <div id="stripe-feedback" className="stripe-feedback" aria-live="polite">
        {(state.error || previewMessage) && <p role={state.error ? "alert" : "status"}>{state.error || previewMessage}</p>}
      </div>
    </form>
  );
}

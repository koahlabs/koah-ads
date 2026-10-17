"use client";

import { useActionState } from "react";
import { connectStripe } from "@/app/account/actions";
import { Icon } from "@/components/icon";
import type { StripeStatus } from "@/lib/dashboard";

const countryNames = new Intl.DisplayNames("en", { type: "region" });

export function StripeConnectForm({
  status,
  eligible,
  countries,
}: {
  status: StripeStatus;
  eligible: boolean;
  countries: string[];
}) {
  const [state, action, pending] = useActionState(connectStripe, { error: "" });
  const existing = status === "connected" || status === "incomplete";
  const disabled = !existing && (!eligible || status === "unavailable");
  const label =
    status === "connected"
      ? "Manage in Stripe"
      : status === "incomplete"
        ? "Finish Stripe setup"
        : "Connect Stripe";
  return (
    <form action={action} className="stripe-connect-form" aria-busy={pending}>
      {!existing && eligible && status !== "unavailable" && (
        <div className="stripe-country">
          <label htmlFor="stripe-country">Country of residence</label>
          <select id="stripe-country" name="country" required defaultValue="" disabled={pending}>
            <option value="" disabled>
              Select country
            </option>
            {countries.map((country) => (
              <option value={country} key={country}>
                {countryNames.of(country) || country}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="submit"
        className="auth-button auth-button-primary"
        disabled={disabled || pending}
        aria-describedby="stripe-help stripe-feedback"
      >
        {disabled && <Icon name="lock" size={14} />}
        <span>{pending ? "Connecting…" : label}</span>
        {!disabled && !pending && <Icon name="arrow-up-right" size={14} />}
      </button>
      <div id="stripe-feedback" className="auth-feedback" aria-live="polite">
        {state.error && <p role="alert">{state.error}</p>}
      </div>
    </form>
  );
}

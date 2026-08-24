"use client";

import { useEffect, useState } from "react";
import {
  ctaLabel,
  fireLabel,
  isHandoff,
  type AdAction,
  type DemoAd,
} from "@/lib/ads";

/** Same window as mux's strip: `CTA_FEEDBACK_MS` in screen.ts. */
const CTA_FEEDBACK_MS = 1200;

export function AdStrip({
  ad,
  claude,
  onOpenChange,
  onHandoff,
}: {
  ad: DemoAd;
  claude: boolean;
  onOpenChange?: (open: boolean) => void;
  onHandoff?: (prompt: string, reply: string, thoughts: string[]) => void;
}) {
  const [fired, setFired] = useState<{ alt: boolean; label: string } | null>(
    null,
  );

  useEffect(() => {
    if (!fired) return;
    const id = window.setTimeout(() => setFired(null), CTA_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [fired]);

  useEffect(() => {
    onOpenChange?.(fired !== null);
  }, [fired, onOpenChange]);

  function fire(alt: boolean, action: AdAction) {
    setFired({ alt, label: fireLabel(action, claude) });
    if (isHandoff(action, claude) && action.prompt && action.reply) {
      onHandoff?.(action.prompt, action.reply, action.thoughts ?? []);
    }
  }

  const primaryFired = fired !== null && !fired.alt;
  const secondaryFired = fired !== null && fired.alt;

  return (
    <div className="ad-in px-3 py-2 text-[0.78rem] leading-5">
      <p>
        <img
          src={ad.favicon}
          alt=""
          width={14}
          height={14}
          className="mr-1.5 inline-block size-3.5 rounded-[3px] align-[-2px]"
        />
        <span className="font-semibold">{ad.brand}</span>
        <span className="text-term-dim"> · Sponsored</span>
      </p>
      <p className="mt-0.5 text-term-ink/90">{ad.body}</p>
      <p className="mt-2">
        <button
          type="button"
          onClick={() => fire(false, ad.primary)}
          className={
            primaryFired
              ? "bg-[#22c55e] px-1.5 py-0.5 font-bold text-[#0c180c]"
              : "bg-term-ink px-1.5 py-0.5 font-medium text-term"
          }
        >
          {primaryFired ? ` ✓ ${fired.label} ` : ctaLabel(ad.primary, claude)}
        </button>
        {ad.secondary ? (
          secondaryFired ? (
            <span className="ml-3 bg-[#22c55e] px-1.5 py-0.5 font-bold text-[#0c180c]">
              {` ✓ ${fired.label} `}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => fire(true, ad.secondary!)}
              className="ml-3 text-term-dim underline decoration-term-dim/60 underline-offset-2"
            >
              {ctaLabel(ad.secondary, claude)}
            </button>
          )
        ) : null}
      </p>
    </div>
  );
}

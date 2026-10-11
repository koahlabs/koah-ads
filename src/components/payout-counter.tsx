"use client";

import { useEffect, useRef, useState } from "react";
import { estimatedPayoutCents, payoutDigits, type PayoutEstimate } from "@/lib/payout-estimate";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function PayoutCounter({ model, initialCents }: { model: PayoutEstimate; initialCents: number }) {
  const [reading, setReading] = useState({ cents: initialCents, previous: initialCents });
  const counterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const counter = counterRef.current;
    if (!counter) return;
    let inView = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const update = (animate: boolean) => {
      const cents = estimatedPayoutCents(model, Date.now());
      setReading(current => {
        const next = Math.max(current.cents, cents);
        if (next === current.cents && (animate || current.previous === next)) return current;
        return { cents: next, previous: animate ? current.cents : next };
      });
    };
    const sync = () => {
      clearInterval(timer);
      timer = undefined;
      if (inView && !document.hidden) {
        update(false); // Resume at the current estimate without replaying missed flips.
        timer = setInterval(() => update(true), 1_000);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(counter);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [model]);

  const digits = payoutDigits(reading.cents);
  const previous = payoutDigits(reading.previous).padStart(digits.length, "0");
  const firstNonZero = digits.search(/[1-9]/);

  return (
    <div className="payout-module" ref={counterRef}>
      <div className="payout-heading">
        <p>Estimated payouts</p>
        <p className="payout-scope">Koah network · since {date.format(new Date(model.periodStart))}</p>
      </div>
      <div className="payout-board" role="img" aria-label={`${usd.format(reading.cents / 100)} in estimated Koah network payouts`}
        title={`Estimate: paid Koah-native impressions × ${usd.format(model.cpmCents / 100)} CPM × ${model.sharePercent}%. The counter projects the ${date.format(new Date(model.periodStart))}–${date.format(new Date(Date.parse(model.periodEnd) - 1))} daily average. This is not a payment ledger.`}>
        <span className="payout-currency" aria-hidden="true">$</span>
        {[...digits].map((digit, index) => {
          if (!/\d/.test(digit)) return <span key={`separator-${index}`} className="payout-separator" aria-hidden="true">{digit}</span>;
          const oldDigit = previous[index];
          const changed = oldDigit !== digit;
          const leading = index < (firstNonZero < 0 ? digits.length - 4 : firstNonZero);
          return (
            <span className={`flip-card${leading ? " flip-card-leading" : ""}`} key={`digit-${digits.length}-${index}`} aria-hidden="true">
              <span className="flip-face flip-top"><span>{digit}</span></span>
              <span className="flip-face flip-bottom"><span>{digit}</span></span>
              {changed && (
                <span key={`${oldDigit}-${digit}-${reading.cents}`} className="flip-motion">
                  <span className="flip-face flip-bottom flip-previous"><span>{oldDigit}</span></span>
                  <span className="flip-face flip-top flip-leaving"><span>{oldDigit}</span></span>
                  <span className="flip-face flip-bottom flip-arriving"><span>{digit}</span></span>
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

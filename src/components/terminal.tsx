"use client";

import { useEffect, useState } from "react";
import { AdStrip } from "@/components/ad-strip";
import { DEMO_ADS } from "@/lib/ads";

const AD_MS = 4200;
const COMMAND = "claude";
const TYPE_MS = 70;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Terminal() {
  const [typed, setTyped] = useState(0);
  const [session, setSession] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [tabOpen, setTabOpen] = useState(false);

  const ad = DEMO_ADS[adIndex];

  useEffect(() => {
    if (prefersReducedMotion()) {
      setTyped(COMMAND.length);
      setSession(true);
      return;
    }

    let cancelled = false;
    let timer = 0;

    const typeNext = (n: number) => {
      if (cancelled) return;
      if (n < COMMAND.length) {
        timer = window.setTimeout(() => {
          setTyped(n + 1);
          typeNext(n + 1);
        }, TYPE_MS);
        return;
      }
      timer = window.setTimeout(() => {
        if (!cancelled) setSession(true);
      }, 280);
    };

    timer = window.setTimeout(() => typeNext(0), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion() || tabOpen) return;
    const id = window.setInterval(() => {
      setAdIndex((i) => (i + 1) % DEMO_ADS.length);
    }, AD_MS);
    return () => window.clearInterval(id);
  }, [tabOpen]);

  return (
    <div className="term w-full overflow-hidden rounded-[10px] border border-term-line bg-term font-mono text-[14px] leading-[19px] text-term-ink">
      <div className="relative flex h-11 shrink-0 items-center justify-center">
        <div className="absolute left-5 flex gap-2" aria-hidden>
          <span className="size-3 rounded-full bg-muted/60" />
          <span className="size-3 rounded-full bg-muted/60" />
          <span className="size-3 rounded-full bg-muted/60" />
        </div>
        <div className="text-sm text-muted">mux</div>
      </div>
      <div className="pointer-events-none min-h-[12.5rem] select-none px-4 py-3.5">
        {session ? (
          <div className="text-term-ink/90">
            <p>
              <span className="text-[#d97757]">✻</span> Welcome to Claude Code
            </p>
            <p className="mt-5">
              <span className="text-term-dim">❯</span>
              <span className="caret ml-1">▋</span>
            </p>
          </div>
        ) : (
          <p>
            <span className="text-term-dim">~ %</span> {COMMAND.slice(0, typed)}
            <span className="caret ml-px">▋</span>
          </p>
        )}
      </div>
      <div className="border-t border-term-line">
        <AdStrip
          key={ad.brand}
          ad={ad}
          claude={session}
          onOpenChange={setTabOpen}
        />
      </div>
    </div>
  );
}

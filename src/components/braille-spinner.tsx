"use client";

import { useEffect, useState } from "react";

/** Ported from the website hero: github.com/czl9707/agents-are-thinking. */
const FRAMES = ["⠇", "⡆", "⣄", "⣠", "⢰", "⠸", "⠙", "⠋"];
const INTERVAL_MS = 100;

export function BrailleSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % FRAMES.length),
      INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden
      className="inline-flex w-[1em] shrink-0 justify-center font-mono leading-none"
    >
      {FRAMES[frame]}
    </span>
  );
}

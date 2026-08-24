"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function RollingDigit({ digit }: { digit: number }) {
  const reduce = useReducedMotion();
  const prev = useRef(digit);
  const [from, setFrom] = useState(digit);
  const [to, setTo] = useState(digit);

  useLayoutEffect(() => {
    const start = prev.current;
    if (digit === start) return;
    const dest = digit < start ? digit + 10 : digit;
    setFrom(start);
    setTo(reduce ? digit : dest);
    prev.current = digit;
  }, [digit, reduce]);

  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-bottom">
      <motion.span
        className="flex flex-col"
        initial={false}
        animate={{ y: `${-to}em` }}
        transition={
          reduce || to === from
            ? { duration: 0 }
            : { duration: 0.55, ease: EASE }
        }
      >
        {STRIP.map((n, i) => (
          <span
            key={i}
            className="block h-[1em] w-[1ch] text-center leading-[1em]"
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function randomImpressionMills() {
  return 3 + Math.floor(Math.random() * 8);
}

export function EarningsTicker({ mills }: { mills: number }) {
  const amount = (mills / 1000).toFixed(3);

  return (
    <span
      className="inline-flex h-[1em] items-center font-mono tabular-nums"
      aria-label={`Earned $${amount}`}
    >
      <span>$</span>
      {amount.split("").map((ch, i) =>
        ch === "." ? (
          <span key="dot">.</span>
        ) : (
          <RollingDigit key={amount.length - 1 - i} digit={Number(ch)} />
        ),
      )}
    </span>
  );
}

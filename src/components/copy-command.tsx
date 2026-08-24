"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const COMMAND = "npm i -g @koah/mux";
const EASE = [0.16, 1, 0.3, 1] as const;

export function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMAND);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy ${COMMAND}`}
      className="inline-flex w-fit items-center gap-2.5 rounded-full border border-chip-line bg-chip px-3.5 py-1.5 font-mono text-[0.85rem] text-chip-ink"
    >
      <span className="text-chip-dim">$</span>
      <span>{COMMAND}</span>
      <span className="relative size-3.5">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.svg
              key="check"
              viewBox="0 0 16 16"
              className="absolute inset-0 size-3.5 text-[#22c55e]"
              aria-hidden
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { scale: 0.6, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
            >
              <motion.path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduce ? 0 : 0.32, ease: EASE, delay: reduce ? 0 : 0.04 }}
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="copy"
              viewBox="0 0 16 16"
              className="absolute inset-0 size-3.5 text-chip-dim"
              aria-hidden
              initial={reduce ? false : { scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { scale: 0.85, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE }}
            >
              <rect
                x="5.25"
                y="5.25"
                width="7.5"
                height="7.5"
                rx="1.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M3.5 10.5V3.75A1.25 1.25 0 0 1 4.75 2.5H10.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}

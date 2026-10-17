"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";

const COLORS = ["#e9b500", "#ffd34d", "#1f8a4c", "#3aa86a", "#ffffff"];
const DURATION_MS = 1800;

// A center burst, then two side cannons for a moment. Skipped when the user prefers reduced motion.
export function Confetti() {
  useEffect(() => {
    const options = { colors: COLORS, disableForReducedMotion: true, zIndex: 50 };
    confetti({
      ...options,
      particleCount: 140,
      spread: 100,
      startVelocity: 45,
      origin: { y: 0.35 },
    });
    const end = Date.now() + DURATION_MS;
    let frame = requestAnimationFrame(function cannons() {
      confetti({ ...options, particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
      confetti({ ...options, particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
      if (Date.now() < end) frame = requestAnimationFrame(cannons);
    });
    return () => {
      cancelAnimationFrame(frame);
      confetti.reset();
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useRef } from "react";

export function DitherBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) return;

    let inView = true;
    const syncPlayback = () => {
      background.style.setProperty("--dither-play-state", inView && !document.hidden ? "running" : "paused");
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    });

    observer.observe(background);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, []);

  return (
    <div className="dither-background" ref={backgroundRef} aria-hidden="true">
      <div className="dither-background-grain" />
    </div>
  );
}

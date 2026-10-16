"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/icon";
import { ClaudeCodePreview } from "@/components/claude-code-preview";
import { ClaudeDesktopPreview } from "@/components/claude-desktop-preview";

export function ProductPreview() {
  const [platform, setPlatform] = useState<"code" | "desktop">("code");
  const [replay, setReplay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const desktop = platform === "desktop";

  useEffect(() => {
    const preview = windowRef.current;
    if (!preview) return;

    let inView = false;
    const updatePlayback = () => setIsPlaying(inView && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.intersectionRatio >= 0.2;
        updatePlayback();
      },
      { threshold: 0.2 },
    );

    observer.observe(preview);
    document.addEventListener("visibilitychange", updatePlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
    };
  }, []);

  function selectPlatform(nextPlatform: "code" | "desktop") {
    setPlatform(nextPlatform);
    setReplay((count) => count + 1);
  }

  return (
    <figure className="product-preview">
      <noscript>
        <style>{`.preview-scene * { animation: none !important; } .preview-thinking, .preview-replay { display: none !important; }`}</style>
      </noscript>
      <div
        className="preview-window"
        ref={windowRef}
        style={{ "--preview-play-state": isPlaying ? "running" : "paused" } as CSSProperties}
      >
        <div className="preview-scene" key={`${platform}-${replay}`}>
          {desktop ? <ClaudeDesktopPreview /> : <ClaudeCodePreview />}
        </div>
      </div>
      <div className="preview-actions">
        <div className="preview-tabs" role="group" aria-label="Preview platform">
          <button type="button" aria-pressed={!desktop} onClick={() => selectPlatform("code")}>
            <Icon name="terminal" />
            Code
          </button>
          <button type="button" aria-pressed={desktop} onClick={() => selectPlatform("desktop")}>
            <Icon name="desktop" />
            Desktop
          </button>
        </div>
        <button
          type="button"
          className="preview-replay"
          aria-label={`Replay Claude ${desktop ? "Desktop" : "Code"} preview`}
          onClick={() => setReplay((count) => count + 1)}
        >
          <Icon name="replay" size={14} />
          Replay
        </button>
      </div>
    </figure>
  );
}

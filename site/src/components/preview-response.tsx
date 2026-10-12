import type { CSSProperties } from "react";

const RESPONSE_START = 650;
const WORD_INTERVAL = 45;
const WORD_DURATION = 120;

export function previewTiming(text: string): CSSProperties {
  const responseEnd = RESPONSE_START + (text.split(" ").length - 1) * WORD_INTERVAL + WORD_DURATION;

  return {
    "--preview-complete-delay": `${responseEnd + 100}ms`,
    "--preview-ad-delay": `${responseEnd + 350}ms`,
    "--preview-earnings-delay": `${responseEnd + 850}ms`,
  } as CSSProperties;
}

export function PreviewResponse({ text }: { text: string }) {
  return (
    <>
      <span className="preview-thinking" aria-hidden="true"><i /><i /><i /></span>
      <span className="preview-response">
        {text.split(" ").map((word, index) => (
          <span
            className="preview-word"
            key={index}
            style={{ animationDelay: `${RESPONSE_START + index * WORD_INTERVAL}ms` }}
          >
            {word}{" "}
          </span>
        ))}
      </span>
    </>
  );
}

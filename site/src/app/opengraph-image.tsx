import { ImageResponse } from "next/og";

export const alt = "Sidequest — Earn while you use Claude. Join the waitlist.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 72px", background: "#000", color: "#ededed", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>sidequest</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 79, letterSpacing: -3, lineHeight: 1.15 }}><span>Earn while you</span><span>use Claude.</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 23, color: "#a1a1a1" }}>
        <span>Claude Code & Claude Desktop.</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          Join the waitlist
          {/* Keep the Phosphor bold path inline: the image renderer cannot render forwardRef components. */}
          <svg width="26" height="26" viewBox="0 0 256 256" fill="#a1a1a1">
            <path d="M204,64V168a12,12,0,0,1-24,0V93L72.49,200.49a12,12,0,0,1-17-17L163,76H88a12,12,0,0,1,0-24H192A12,12,0,0,1,204,64Z" />
          </svg>
        </span>
      </div>
    </div>, size,
  );
}

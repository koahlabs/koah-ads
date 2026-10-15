import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Sidequest — Earn while you use Claude. A gold 3D coin. Join the waitlist for Claude Code and Claude Desktop.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

// Load the local asset once. Social crawlers must not depend on a second host
// or a network request to render the coin.
const coin = readFile(join(process.cwd(), "public/og/mario-coin.png")).then(
  (data) => `data:image/png;base64,${data.toString("base64")}`,
);

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#000",
        color: "#ededed",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 72,
          top: 64,
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        sidequest
      </div>

      {/* Keep all copy above y=480. X places its card title over the bottom
          of the image, so the bottom 150px contains no essential content. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 72,
          top: 188,
          width: 640,
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 78,
            letterSpacing: -3,
            lineHeight: 1.1,
          }}
        >
          <span>Earn while you</span>
          <span>use Claude.</span>
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#a1a1a1" }}>
          Claude Code &amp; Claude Desktop.
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, fontSize: 24 }}
        >
          <span>Join the waitlist</span>
          {/* Use the Phosphor bold path directly; the OG renderer cannot render forwardRef components. */}
          <svg width="24" height="24" viewBox="0 0 256 256" fill="#ededed">
            <path d="M204,64V168a12,12,0,0,1-24,0V93L72.49,200.49a12,12,0,0,1-17-17L163,76H88a12,12,0,0,1,0-24H192A12,12,0,0,1,204,64Z" />
          </svg>
        </div>
      </div>

      {/* The transparent asset includes margin around the complete coin. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 712,
          top: 80,
          width: 460,
          height: 460,
          backgroundImage: `url(${await coin})`,
          backgroundSize: "460px 460px",
        }}
      />
    </div>,
    size,
  );
}

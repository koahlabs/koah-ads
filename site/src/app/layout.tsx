import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
  title: "mux — Earn while you use Claude",
  description:
    "Get a share of the ad revenue while you use Claude Code or Claude Desktop. Join the mux waitlist for early access.",
  openGraph: { title: "mux — Earn while you use Claude", description: "A mod for Claude Code and Claude Desktop. Join the waitlist for early access.", siteName: "mux", type: "website" },
  twitter: { card: "summary_large_image", creator: "@guard_if", title: "mux — Earn while you use Claude", description: "A mod for Claude Code and Claude Desktop. Join the waitlist." },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply a saved choice before the page paints. CSS handles the system default. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var theme=localStorage.getItem("mux-theme");if(theme==="light"||theme==="dark")document.documentElement.dataset.theme=theme}catch{}` }} />
      </head>
      <body className="min-h-full bg-bg text-ink"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:p-3 focus:text-bg">Skip to content</a>{children}</body>
    </html>
  );
}

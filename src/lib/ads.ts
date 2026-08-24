export type AdKind = "link" | "command";

export type AdAction = {
  label: string;
  kind: AdKind;
  assistantLabel?: string;
  prompt?: string;
  thoughts?: string[];
  reply?: string;
};

export type DemoAd = {
  favicon: string;
  brand: string;
  body: string;
  primary: AdAction;
  secondary?: AdAction;
};

export const DEMO_ADS: DemoAd[] = [
  {
    favicon: "/favicons/baseten.png",
    brand: "Baseten",
    body: "Run inference in production without the ops.",
    primary: { label: "⌃G · Book a demo", kind: "link" },
    secondary: {
      label: "⌃F · Read the docs",
      kind: "link",
      assistantLabel: "⌃F · Ask Claude",
      prompt:
        "Look at this project, then tell me how Baseten would fit — dedicated GPUs, autoscaling, fast cold starts.",
      thoughts: ["Read page.tsx", "Read src/lib/ads.ts"],
      reply:
        "This is a static mux landing page. Baseten wouldn't replace the UI — it'd sit behind any model call you add later. Dedicated GPUs and sub-second cold starts matter once you have inference. Here, the ad strip is the product.",
    },
  },
  {
    favicon: "/favicons/vercel.png",
    brand: "Vercel",
    body: "Ship your frontend to the edge in seconds.",
    primary: {
      label: "⌃G · npm i -g vercel",
      kind: "command",
      assistantLabel: "⌃G · Set up Vercel deploys",
      prompt:
        "Set up this project to deploy on Vercel: install the CLI, add a zero-config setup, and wire preview URLs for every push.",
      thoughts: ["Read package.json", "Read next.config.ts"],
      reply:
        "It's already Next.js — `npx vercel` is enough. No vercel.json needed. Every git push gets a preview URL. I wouldn't add a platform file until you have env vars or a custom build.",
    },
  },
  {
    favicon: "/favicons/neon.svg",
    brand: "Neon",
    body: "Serverless Postgres that scales to zero.",
    primary: {
      label: "⌃G · npx neonctl auth",
      kind: "command",
      assistantLabel: "⌃G · Add a Neon Postgres DB",
      prompt:
        "Add a serverless Neon Postgres database to this project: create the DB, store the connection string, and wire up a client.",
      thoughts: ["Read src/app/page.tsx", "Read package.json"],
      reply:
        "There's no server state here — the landing is static. Neon would be for a later API: sessions, payouts, ad events. I'd wait until you have a route that writes, then add neonctl and a client.",
    },
  },
];

export function ctaLabel(action: AdAction, claude: boolean): string {
  return claude && action.assistantLabel ? action.assistantLabel : action.label;
}

export function isHandoff(action: AdAction, claude: boolean): boolean {
  return Boolean(action.prompt && action.reply);
}

export function fireLabel(action: AdAction, claude: boolean): string {
  if (isHandoff(action, claude)) return "Typed · ⏎ to send";
  if (action.kind === "command") return claude ? "Typed · ⏎ to send" : "Applied";
  return "Opened";
}

export type AdKind = "link" | "command";

export type AdAction = {
  label: string;
  kind: AdKind;
  assistantLabel?: string;
};

export type DemoAd = {
  icon: string;
  iconColor: string;
  brand: string;
  body: string;
  primary: AdAction;
  secondary?: AdAction;
};

export const DEMO_ADS: DemoAd[] = [
  {
    icon: "■",
    iconColor: "#19E76E",
    brand: "Baseten",
    body: "Run inference in production without the ops.",
    primary: { label: "⌃G · Book a demo", kind: "link" },
    secondary: {
      label: "⌃F · Read the docs",
      kind: "link",
      assistantLabel: "⌃F · Ask Claude",
    },
  },
  {
    icon: "▲",
    iconColor: "#ffffff",
    brand: "Vercel",
    body: "Ship your frontend to the edge in seconds.",
    primary: {
      label: "⌃G · npm i -g vercel",
      kind: "command",
      assistantLabel: "⌃G · Set up Vercel deploys",
    },
  },
  {
    icon: "◉",
    iconColor: "#00E599",
    brand: "Neon",
    body: "Serverless Postgres that scales to zero.",
    primary: {
      label: "⌃G · npx neonctl auth",
      kind: "command",
      assistantLabel: "⌃G · Add a Neon Postgres DB",
    },
  },
];

export function ctaLabel(action: AdAction, claude: boolean): string {
  return claude && action.assistantLabel ? action.assistantLabel : action.label;
}

export function fireLabel(action: AdAction, claude: boolean): string {
  if (action.kind === "link" && !(claude && action.assistantLabel)) {
    return "Opened";
  }
  if (claude) return "Typed · ⏎ to send";
  return action.kind === "command" ? "Applied" : "Opened";
}

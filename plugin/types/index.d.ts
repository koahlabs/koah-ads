export type KoahAd = {
  adText: string
  adCta: string
  adLink: string
  advertiser: { name: string; rootDomain: string; iconUrl: string | null }
  impressionLink: string
  /** The advertiser favicon as base64 PNG, fetched by the mod. */
  iconPng?: string
}

/** One ad per answered turn, matched to its last message by the answer text. */
export type AdSlot = { answer: string; ad: KoahAd }

declare module 'claude-code' {
  interface PluginState {
    'sidequest': { slots: AdSlot[]; isOff: boolean }
  }
}

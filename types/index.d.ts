export type KoahAd = {
  adText: string
  adCta: string
  adLink: string
  advertiser: { name: string; rootDomain: string; iconUrl: string | null }
  impressionLink: string
  /** The advertiser favicon as base64 PNG, fetched by the mod. */
  iconPng?: string
  /** The favicon as 16px pixel-rect SVG markup, for the desktop. */
  iconSvg?: string
}

declare module 'claude-code' {
  interface PluginState {
    'koah-ads': { ad: KoahAd | null; isOff: boolean }
  }
}

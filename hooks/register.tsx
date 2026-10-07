import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { KoahAd } from '../types'

const API = 'https://app.koah.ai/api/v1/server/request_ad'
const MAX_TEXT = 4000

const ad = atom({ plugin: 'koah-ads', key: 'ad' } as const, null)
const isOff = atom({ plugin: 'koah-ads', key: 'isOff' } as const, false)

type Options = { servingToken?: string; publisherId?: string; demo?: boolean }

let opts: Options = {}
let question = ''
// Impression URLs already reported this load; Koah dedupes server-side too.
const reported = new Set<string>()

async function credentials($: EngineInterface) {
  const token = opts.servingToken || (await $.env.get('KOAH_SERVING_TOKEN'))
  const publisherId = opts.publisherId || (await $.env.get('KOAH_PUBLISHER_ID'))
  return token && publisherId ? { token, publisherId } : null
}

// Opaque, stable per-machine user id: never an email or phone number.
async function userId($: EngineInterface): Promise<string> {
  const saved = await $.store.get('userId')
  if (typeof saved === 'string') return saved
  const id = `cc_${crypto.randomUUID()}`
  await $.store.set('userId', id)
  return id
}

// request_ad requires user.ip, and Koah geo-targets on it, so send the public
// address. Looked up once per load; a failed lookup is retried next request.
const IP_LOOKUP = 'https://api.ipify.org'
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
let ip: string | undefined
async function publicIp($: EngineInterface): Promise<string | undefined> {
  if (ip) return ip
  const res = await $.http.fetch(IP_LOOKUP)
  const found = res.text.trim()
  if (res.ok && IPV4.test(found)) ip = found
  return ip
}

// $.http.fetch returns text only, so curl fetches the icon and base64 encodes
// it. Many advertisers serve an ICO (Baseten does), so sips converts any
// non-PNG to a 64px PNG first. After a `---` line it prints a 16px BMP as hex
// for the desktop, which drops an <image> embedded in an Svg.
const FETCH_ICON = `
t=$(mktemp -d) || exit 1
trap 'rm -rf "$t"' EXIT
curl -sfL --max-time 5 "$1" -o "$t/icon" || exit 1
if ! head -c 8 "$t/icon" | grep -q PNG; then
  sips -s format png -Z 64 "$t/icon" --out "$t/icon.png" >/dev/null 2>&1 || exit 1
  mv "$t/icon.png" "$t/icon"
fi
base64 < "$t/icon"
echo ---
sips -s format bmp -z 16 16 "$t/icon" --out "$t/icon.bmp" >/dev/null 2>&1 \\
  && od -An -v -tx1 "$t/icon.bmp"
`

// A 32-bit BGRA BMP as SVG rects, one per run of equal pixels, cut to a
// circle: plain vector markup, with no href for the desktop to strip.
function bmpToSvg(hex: string): string | undefined {
  const bytes = hex.match(/../g)?.map(x => parseInt(x, 16)) ?? []
  const b = (i: number) => bytes[i] ?? 0
  const u32 = (i: number) => (b(i) | (b(i + 1) << 8) | (b(i + 2) << 16) | (b(i + 3) << 24)) >>> 0
  if (bytes.length < 54 || b(0) !== 0x42 || b(1) !== 0x4d || (b(28) | (b(29) << 8)) !== 32) return undefined
  const offset = u32(10)
  const w = u32(18)
  const rawH = u32(22) | 0
  const h = Math.abs(rawH)
  if (w !== 16 || h !== 16 || bytes.length < offset + w * h * 4) return undefined
  const rects: string[] = []
  for (let y = 0; y < h; y++) {
    const row = rawH < 0 ? y : h - 1 - y
    let start = 0
    let fill: string | null = null
    for (let x = 0; x <= w; x++) {
      let next: string | null = null
      if (x < w) {
        const i = offset + (row * w + x) * 4
        const [blue, green, red, a] = [b(i), b(i + 1), b(i + 2), b(i + 3)]
        const inCircle = (x + 0.5 - 8) ** 2 + (y + 0.5 - 8) ** 2 <= 64
        if (inCircle && a > 0) {
          next = `fill="rgb(${red},${green},${blue})"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(2)}"` : ''}`
        }
      }
      if (next === fill && x < w) continue
      if (fill) rects.push(`<rect x="${start}" y="${y}" width="${x - start}" height="1" ${fill}/>`)
      start = x
      fill = next
    }
  }
  if (!rects.length) return undefined
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.join('')}</svg>`
}

type Icon = { png?: string; svg?: string }
const icons = new Map<string, Icon>()
async function favicon($: EngineInterface, advertiser: KoahAd['advertiser']): Promise<Icon> {
  const url = advertiser.iconUrl
    || (advertiser.rootDomain ? `https://${advertiser.rootDomain}/favicon.ico` : null)
  if (!url) return {}
  const cached = icons.get(url)
  if (cached) return cached
  const { exitCode, stdout } = await $.process.run(
    ['/bin/sh', '-c', FETCH_ICON, 'sh', url],
  )
  const [pngPart = '', bmpPart = ''] = stdout.split('---')
  const png = pngPart.replace(/\s/g, '')
  // Keep PNGs only: a bad image makes the engine refuse the whole band.
  const icon: Icon = exitCode === 0 && png.startsWith('iVBORw0KGgo')
    ? { png, svg: bmpToSvg(bmpPart.replace(/\s/g, '')) }
    : {}
  icons.set(url, icon)
  return icon
}

async function reportImpression($: EngineInterface, url: string, token: string) {
  if (reported.has(url)) return
  reported.add(url)
  for (const wait of [0, 1000, 4000, 15000]) {
    if (wait) await $.clock.sleep(wait)
    const res = await $.http.fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return
    // Permanent errors stop; 429 and 5xx back off and reuse the same URL.
    if (res.status !== 429 && res.status < 500) return
  }
}

export const register: Register = (on, options) => {
  opts = options as Options

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'koah-ads',
      description: 'Turn Koah sponsored ads on or off for this session',
    })
    if (!(await credentials($))) {
      $.ui.toast('koah-ads: set servingToken and publisherId in /config, or KOAH_SERVING_TOKEN and KOAH_PUBLISHER_ID')
    }
    return next(e)
  })

  on('command.run', { command: 'koah-ads' }, async $ => {
    const off = !(await read($, isOff))
    await update($, isOff, () => off)
    if (off) await update($, ad, () => null)
    return { text: off ? 'Koah ads off.' : 'Koah ads on.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // The current ad stays up until request_ad serves a new one.
    question = e.text
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.reason !== 'answer' || !question.trim()) return result
    if (await read($, isOff)) return result
    const creds = await credentials($)
    if (!creds) return result
    const ip = await publicIp($)
    if (!ip) {
      $.ui.toast('koah-ads: could not look up the public IP; no ad requested')
      return result
    }

    const res = await $.http.fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publisherId: creds.publisherId,
        platform: 'cli',
        user: { id: await userId($), ip },
        context: {
          type: 'conversation',
          question: question.slice(0, MAX_TEXT),
          answer: e.answer.slice(0, MAX_TEXT) || undefined,
          externalConversationId: (await $.session.id()).slice(0, 64),
        },
        demo: opts.demo ?? false,
      }),
    })

    if (res.status === 200) {
      const served = JSON.parse(res.text) as KoahAd
      const icon = await favicon($, served.advertiser)
      served.iconPng = icon.png
      served.iconSvg = icon.svg
      await update($, ad, () => served)
    } else if (res.status !== 204) {
      $.ui.status(`koah-ads: request_ad ${res.status}`)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isOff))) return next(e)

    const { Box, Text, Link } = $.ui.resolve(e)
    const creds = await credentials($)
    if (!creds) {
      return (
        <Text dimColor>
          koah-ads: no credentials. Add KOAH_SERVING_TOKEN and KOAH_PUBLISHER_ID to the env block of ~/.claude/settings.json, then start a new session.
        </Text>
      )
    }
    const current = await read($, ad)
    if (!current) return next(e)

    // The ad is on screen now: that is the CLI impression event.
    void reportImpression($, current.impressionLink, creds.token)

    // The terminal draws the PNG itself; the desktop draws the pixel SVG.
    const { iconPng: png, iconSvg: svg } = current
    let icon = null
    if (png && e.surface === 'terminal') {
      const { Image } = $.ui.resolve(e)
      icon = <Image source={{ png }} columns={2} rows={1} alt=" " />
    } else if (svg && e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      icon = <Svg source={svg} width={16} height={16} alt=" " />
    }

    // Advertiser and CTA on one line, then the full ad text, wrapped.
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" gap={1}>
          {icon}
          <Text bold>{current.advertiser.name}</Text>
          <Text dimColor>Sponsored</Text>
          <Box flexGrow={1} />
          <Link href={current.adLink}>{current.adCta} →</Link>
        </Box>
        <Text wrap="wrap">{current.adText}</Text>
      </Box>
    )
  })
}

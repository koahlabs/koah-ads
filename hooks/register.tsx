import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AdSlot, KoahAd } from '../types'

const API = 'https://app.koah.ai/api/v1/server/request_ad'
const MAX_TEXT = 4000
const MAX_SLOTS = 50

const slots = atom({ plugin: 'sidequest', key: 'slots' } as const, [] as AdSlot[])
const isOff = atom({ plugin: 'sidequest', key: 'isOff' } as const, false)

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
// non-PNG to a 64px PNG first.
const FETCH_ICON = `
t=$(mktemp -d) || exit 1
trap 'rm -rf "$t"' EXIT
curl -sfL --max-time 5 "$1" -o "$t/icon" || exit 1
if ! head -c 8 "$t/icon" | grep -q PNG; then
  sips -s format png -Z 64 "$t/icon" --out "$t/icon.png" >/dev/null 2>&1 || exit 1
  mv "$t/icon.png" "$t/icon"
fi
base64 < "$t/icon"
`

const icons = new Map<string, string | undefined>()
async function favicon($: EngineInterface, advertiser: KoahAd['advertiser']): Promise<string | undefined> {
  const url = advertiser.iconUrl
    || (advertiser.rootDomain ? `https://${advertiser.rootDomain}/favicon.ico` : null)
  if (!url) return undefined
  if (icons.has(url)) return icons.get(url)
  const { exitCode, stdout } = await $.process.run(['/bin/sh', '-c', FETCH_ICON, 'sh', url])
  const png = stdout.replace(/\s/g, '')
  // Keep PNGs only: a bad image makes the engine refuse the whole tree.
  const icon = exitCode === 0 && png.startsWith('iVBORw0KGgo') ? png : undefined
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

// $.state outlives a reload, so a slot can hold an ad from an older shape.
function isAd(ad: unknown): ad is KoahAd {
  const a = ad as Partial<KoahAd> | null
  return (
    typeof a?.adText === 'string' &&
    typeof a.adCta === 'string' &&
    typeof a.adLink === 'string' &&
    typeof a.impressionLink === 'string' &&
    typeof a.advertiser?.name === 'string'
  )
}

export const register: Register = (on, options) => {
  opts = options as Options

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sidequest',
      description: 'Turn Koah sponsored ads on or off for this session',
    })
    if (!(await credentials($))) {
      $.ui.toast('sidequest: set servingToken and publisherId in /config, or KOAH_SERVING_TOKEN and KOAH_PUBLISHER_ID')
    }
    return next(e)
  })

  on('command.run', { command: 'sidequest' }, async $ => {
    const off = !(await read($, isOff))
    await update($, isOff, () => off)
    return { text: off ? 'Koah ads off.' : 'Koah ads on.' }
  })

  on('prompt.submit', async ($, e, next) => {
    question = e.text
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer' || !e.answer.trim()) return result
    if (await read($, isOff)) return result
    const creds = await credentials($)
    if (!creds) return result
    const ip = await publicIp($)
    if (!ip) {
      $.ui.toast('sidequest: could not look up the public IP; no ad requested')
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
          question: question.slice(0, MAX_TEXT) || undefined,
          answer: e.answer.slice(0, MAX_TEXT),
          externalConversationId: (await $.session.id()).slice(0, 64),
        },
        demo: opts.demo ?? false,
      }),
    })

    if (res.status === 200) {
      const served = JSON.parse(res.text) as KoahAd
      served.iconPng = await favicon($, served.advertiser)
      const slot: AdSlot = { answer: e.answer.trim(), ad: served }
      await update($, slots, list => [...(list ?? []), slot].slice(-MAX_SLOTS))
    } else if (res.status !== 204) {
      $.ui.status(`sidequest: request_ad ${res.status}`)
    }
    return result
  })

  // The ad sits under the last message of the reply it was served for.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (await read($, isOff)) return next(e)
    const text = e.props.text.trim()
    const list = await read($, slots)
    const slot = text === '' ? undefined : list.find(s => s.answer.endsWith(text))
    if (slot === undefined || !isAd(slot.ad)) return next(e)

    const { ad } = slot
    const { Box, Text, Link, Markdown } = $.ui.resolve(e)

    // The ad is on screen now: that is the CLI impression event.
    const creds = await credentials($)
    if (creds) void reportImpression($, ad.impressionLink, creds.token)

    let icon = null
    if (ad.iconPng && e.surface === 'terminal') {
      const { Image } = $.ui.resolve(e)
      icon = <Image source={{ png: ad.iconPng }} columns={2} rows={1} alt=" " />
    } else if (ad.iconPng && e.surface === 'desktop') {
      // The PNG inside an Svg, in a box of fixed size (2 cells by 1): in a row an
      // Svg with no sized box collapses. The desktop draws nothing for an Svg
      // whose alt is blank, so it carries the advertiser's name.
      const { Svg } = $.ui.resolve(e)
      const source =
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        `<image href="data:image/png;base64,${ad.iconPng}" width="64" height="64"/></svg>`
      icon = (
        <Box width={2} height={1} flexShrink={0}>
          <Svg source={source} width={16} height={16} alt={`${ad.advertiser.name} logo`} />
        </Box>
      )
    }

    // Box has no top-only border. The terminal gets a rule sized to fit (a cut
    // Text ends in an ellipsis); the remote surfaces draw a markdown rule.
    const divider = e.surface === 'terminal'
      ? <Text dimColor>{'─'.repeat(Math.max((e.viewport?.columns ?? 64) - 4, 8))}</Text>
      : <Markdown text="---" />

    // The reply, a divider, then the ad: advertiser line, the ad text wrapped,
    // and the CTA as a bordered link. No side padding, one gap between rows;
    // rows stretch to the full width and only the button keeps its own.
    return (
      <Box flexDirection="column" width="100%">
        <Markdown text={e.props.text} />
        <Box flexDirection="column" width="100%" marginTop={1}>{divider}</Box>
        <Box flexDirection="column" width="100%" gap={1} marginTop={1}>
          <Box flexDirection="row" gap={1}>
            {icon}
            <Text bold>{ad.advertiser.name}</Text>
            <Text dimColor>Sponsored</Text>
          </Box>
          <Text wrap="wrap">{ad.adText}</Text>
          <Box alignSelf="flex-start" borderStyle="round" borderDimColor paddingX={1}>
            <Text>
              <Link href={ad.adLink}>{ad.adCta}</Link>
            </Text>
          </Box>
        </Box>
      </Box>
    )
  })
}

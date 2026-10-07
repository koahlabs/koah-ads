import { expect, mock, test } from 'claude-code/testing'

const AD = {
  adText: 'Find your next pair of running shoes.',
  adCta: 'Explore',
  adLink: 'https://app.koah.ai/kclk/648dd783-4b6f-4efa-b8a4-f7a95ccfce47',
  advertiser: { name: 'Example Brand', rootDomain: 'example.com', iconUrl: 'https://www.google.com/s2/favicons?domain=example.com&sz=64' },
  impressionLink: 'https://app.koah.ai/api/v1/server/impression/648dd783-4b6f-4efa-b8a4-f7a95ccfce47',
}

// A top-down 32-bit BGRA 16px BMP, as `od -An -tx1` prints it, all one green.
function bmpHex(): string {
  const u32 = (n: number) => [n, n >> 8, n >> 16, n >> 24].map(x => x & 0xff)
  const header = [0x42, 0x4d, ...u32(54 + 1024), 0, 0, 0, 0, ...u32(54), ...u32(40),
    ...u32(16), ...u32(-16), 1, 0, 32, 0, ...Array(24).fill(0)]
  const pixels = Array.from({ length: 256 }, () => [25, 231, 110, 255]).flat()
  return [...header, ...pixels].map(x => x.toString(16).padStart(2, '0')).join(' ')
}

const OPTIONS = { servingToken: 'test_token', publisherId: 'pub_test', demo: true }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`shows a labeled ad after an answer and reports one impression (${surface})`, { options: OPTIONS }, async ($, on) => {
    const calls: { url: string; body?: string; auth?: string }[] = []
    on('http.fetch', async (_$, e) => {
      calls.push({ url: e.url, body: e.init?.body, auth: e.init?.headers?.Authorization })
      if (e.url === 'https://api.ipify.org') {
        return { value: { status: 200, ok: true, headers: {}, text: '151.202.10.163' } }
      }
      if (e.url.endsWith('/request_ad')) {
        return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(AD) } }
      }
      return { value: { status: 204, ok: true, headers: {}, text: '' } }
    })
    // The curl pipe answers base64 PNG bytes, then the 16px BMP as hex.
    on('process.run', async (_$, e) => ({ value: {
      exitCode: 0,
      stdout: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==\n---\n' + bmpHex(),
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    } }))
    mock.store(on)
    mock.env(on, {})
    const clock = mock.clock(on)
    on('session.id', async () => ({ value: 'session_abc' }))
    on('prompt.submit', async (_$, e) => ({ text: e.text }))
    on('turn.complete', async (_$, e) => ({ text: e.answer }))

    await $.prompt.submit({ text: 'What should I look for in running shoes?', wait: false, origin: { kind: 'composer' } })
    await $.turn.complete({
      answer: 'Prioritize fit and cushioning.',
      durationMs: 10,
      isAborted: false,
      turnId: 't1',
      reason: 'answer',
    })

    const request = calls.find(c => c.url.endsWith('/request_ad'))
    expect(request?.auth).toBe('Bearer test_token')
    expect(JSON.parse(request?.body ?? '{}')).toMatchObject({
      publisherId: 'pub_test',
      platform: 'cli',
      demo: true,
      user: { ip: '151.202.10.163' },
      context: { type: 'conversation', question: 'What should I look for in running shoes?' },
    })

    const ui = await $.ui.mount({ plugin: 'koah-ads', surface, component: 'AbovePrompt', props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns: 120,
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    } })
    expect(await ui.find({ text: /Example Brand/ })).toBeDefined()
    expect(await ui.find({ text: /Sponsored/ })).toBeDefined()
    expect(await ui.find({ type: surface === 'terminal' ? 'Image' : 'Svg' })).toBeDefined()
    if (surface === 'desktop') {
      const svg = await ui.find({ type: 'Svg' })
      expect(svg?.props.source).toContain('<rect')
      expect(svg?.props.source).not.toContain('href')
    }
    expect(await ui.find({ type: 'Link', text: /Explore/ })).toBeDefined()

    await clock.settle()
    expect(calls.filter(c => c.url === AD.impressionLink)).toHaveLength(1)

    // The next prompt keeps the ad up until a new one arrives.
    await $.prompt.submit({ text: 'And for trails?', wait: false, origin: { kind: 'composer' } })
    expect(await ui.find({ text: /Example Brand/ })).toBeDefined()
  })
}

test('asks for nothing without credentials', async ($, on) => {
  let fetched = 0
  on('http.fetch', async () => { fetched += 1; return { value: { status: 204, ok: true, headers: {}, text: '' } } })
  mock.env(on, {})
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer: 'hello', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  expect(fetched).toBe(0)
})

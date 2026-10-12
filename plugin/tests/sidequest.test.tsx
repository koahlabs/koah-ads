import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const AD = {
  adText: 'Find your next pair of running shoes.',
  adCta: 'Explore',
  adLink: 'https://app.koah.ai/kclk/648dd783-4b6f-4efa-b8a4-f7a95ccfce47',
  advertiser: { name: 'Example Brand', rootDomain: 'example.com', iconUrl: 'https://www.google.com/s2/favicons?domain=example.com&sz=64' },
  impressionLink: 'https://app.koah.ai/api/v1/server/impression/648dd783-4b6f-4efa-b8a4-f7a95ccfce47',
}

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='
const OPTIONS = { servingToken: 'test_token', publisherId: 'pub_test', demo: true }
const ANSWER = 'Look at fit first.\n\nPrioritize fit and cushioning.'

type Call = { url: string; body?: string; auth?: string }

// The world beneath the mod: the Koah API, the icon fetch, and an engine
// drawing of its own for any message the mod leaves alone.
function world(on: On, calls: Call[]) {
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
  on('process.run', async () => ({ value: {
    exitCode: 0, stdout: `${PNG}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false,
  } }))
  mock.store(on)
  mock.env(on, {})
  on('session.id', async () => ({ value: 'session_abc' }))
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('command.run', async () => ({ text: '' }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
}

async function answer($: Parameters<Parameters<typeof test>[2] & Function>[0]) {
  await $.prompt.submit({ text: 'What should I look for in running shoes?', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer: ANSWER, durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
}

const message = (text: string) => ({
  plugin: 'sidequest',
  component: 'AssistantMessage' as const,
  props: { text, isFirstOfReply: false },
  requestId: 'msg_1',
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`shows a labeled ad under the last message of the answer and reports one impression (${surface})`, { options: OPTIONS }, async ($, on) => {
    const calls: Call[] = []
    world(on, calls)
    const clock = mock.clock(on)
    await answer($)

    const request = calls.find(c => c.url.endsWith('/request_ad'))
    expect(request?.auth).toBe('Bearer test_token')
    expect(JSON.parse(request?.body ?? '{}')).toMatchObject({
      publisherId: 'pub_test',
      platform: 'cli',
      demo: true,
      user: { ip: '151.202.10.163' },
      context: { type: 'conversation', question: 'What should I look for in running shoes?' },
    })

    const ui = await $.ui.mount({ ...message('Prioritize fit and cushioning.'), surface })
    expect(await ui.find({ text: /Example Brand/ })).toBeDefined()
    expect(await ui.find({ text: /Sponsored/ })).toBeDefined()
    expect(await ui.find({ type: surface === 'terminal' ? 'Image' : 'Svg' })).toBeDefined()
    if (surface === 'desktop') {
      const svg = await ui.find({ type: 'Svg' })
      expect(svg?.props.source).toContain(`data:image/png;base64,${PNG}`)
      expect(svg?.props.alt).toBe('Example Brand logo')
    }
    expect(await ui.find({ type: 'Link', text: /Explore/ })).toBeDefined()

    await clock.settle()
    expect(calls.filter(c => c.url === AD.impressionLink)).toHaveLength(1)
    await ui.unmount()
  })
}

test('leaves the earlier messages of the answer alone', { options: OPTIONS }, async ($, on) => {
  world(on, [])
  await answer($)

  const ui = await $.ui.mount({ ...message('Look at fit first.'), surface: 'desktop' })
  expect(await ui.find({ text: /engine row/ })).toBeDefined()
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined()
})

test('/sidequest hides the ad and stops requests', { options: OPTIONS }, async ($, on) => {
  const calls: Call[] = []
  world(on, calls)
  await answer($)
  await $.command.run({ command: 'sidequest', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

  const ui = await $.ui.mount({ ...message('Prioritize fit and cushioning.'), surface: 'desktop' })
  expect(await ui.find({ text: /Sponsored/ })).toBeUndefined()

  const before = calls.filter(c => c.url.endsWith('/request_ad')).length
  await answer($)
  expect(calls.filter(c => c.url.endsWith('/request_ad'))).toHaveLength(before)
})

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

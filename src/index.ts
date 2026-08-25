/** Independent Host + tool + loopback RPC capability resolver plugin. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { AwesomeDshCatalogClient } from './catalog.ts'
import { CapabilityResolver } from './resolver.ts'
import { registerCapabilityResolverRpc } from './rpc.ts'
import { collectCurrentCapabilities, createCapabilityResolveTool } from './tool.ts'
import type { ResolvedCapabilityResolverConfig } from './types.ts'

export * from './catalog.ts'
export * from './ranking.ts'
export * from './resolver.ts'
export * from './rpc.ts'
export * from './tool.ts'
export * from './types.ts'

/** Cordis plugin identity. */
export const name = 'capability-resolver'

/** Published rc.2 Host services required by both discovery entry points. */
export const inject = ['loader', 'tools', 'skills', 'connection']

export const DEFAULT_FRESH_CACHE_MS = 900_000
export const DEFAULT_STALE_CACHE_MS = 86_400_000
export const DEFAULT_FETCH_TIMEOUT_MS = 5_000
export const DEFAULT_MAX_CATALOG_BYTES = 8_388_608
export const DEFAULT_MAX_CATALOG_ENTRIES = 5_000
export const DEFAULT_MAX_TASK_CHARS = 2_000
export const DEFAULT_MAX_RESULTS = 8
export const DEFAULT_MAX_CURRENT_MATCHES = 8
export const DEFAULT_MAX_DESCRIPTION_CHARS = 600
export const DEFAULT_MAX_MATCHED_TERMS = 12

/** Loader configuration for bounded catalog and result processing. */
export interface Config {
  readonly freshCacheMs?: number
  readonly staleCacheMs?: number
  readonly fetchTimeoutMs?: number
  readonly maxCatalogBytes?: number
  readonly maxCatalogEntries?: number
  readonly maxTaskChars?: number
  readonly maxResults?: number
  readonly maxCurrentMatches?: number
  readonly maxDescriptionChars?: number
  readonly maxMatchedTerms?: number
}

/** Loader-visible schema. The catalog URL is intentionally not configurable. */
export const Config: z<Config> = z.object({
  freshCacheMs: z.natural().min(1_000).max(86_400_000).default(DEFAULT_FRESH_CACHE_MS),
  staleCacheMs: z.natural().min(1_000).max(604_800_000).default(DEFAULT_STALE_CACHE_MS),
  fetchTimeoutMs: z.natural().min(100).max(60_000).default(DEFAULT_FETCH_TIMEOUT_MS),
  maxCatalogBytes: z.natural().min(65_536).max(33_554_432).default(DEFAULT_MAX_CATALOG_BYTES),
  maxCatalogEntries: z.natural().min(1).max(20_000).default(DEFAULT_MAX_CATALOG_ENTRIES),
  maxTaskChars: z.natural().min(64).max(16_000).default(DEFAULT_MAX_TASK_CHARS),
  maxResults: z.natural().min(1).max(50).default(DEFAULT_MAX_RESULTS),
  maxCurrentMatches: z.natural().min(1).max(50).default(DEFAULT_MAX_CURRENT_MATCHES),
  maxDescriptionChars: z.natural().min(80).max(4_000).default(DEFAULT_MAX_DESCRIPTION_CHARS),
  maxMatchedTerms: z.natural().min(1).max(50).default(DEFAULT_MAX_MATCHED_TERMS),
})

/** Resolve defaults for direct apply calls and reject inconsistent cache ages. */
export function resolveConfig(config: Config = {}): ResolvedCapabilityResolverConfig {
  const resolved: ResolvedCapabilityResolverConfig = {
    freshCacheMs: config.freshCacheMs ?? DEFAULT_FRESH_CACHE_MS,
    staleCacheMs: config.staleCacheMs ?? DEFAULT_STALE_CACHE_MS,
    fetchTimeoutMs: config.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    maxCatalogBytes: config.maxCatalogBytes ?? DEFAULT_MAX_CATALOG_BYTES,
    maxCatalogEntries: config.maxCatalogEntries ?? DEFAULT_MAX_CATALOG_ENTRIES,
    maxTaskChars: config.maxTaskChars ?? DEFAULT_MAX_TASK_CHARS,
    maxResults: config.maxResults ?? DEFAULT_MAX_RESULTS,
    maxCurrentMatches: config.maxCurrentMatches ?? DEFAULT_MAX_CURRENT_MATCHES,
    maxDescriptionChars: config.maxDescriptionChars ?? DEFAULT_MAX_DESCRIPTION_CHARS,
    maxMatchedTerms: config.maxMatchedTerms ?? DEFAULT_MAX_MATCHED_TERMS,
  }
  if (resolved.staleCacheMs < resolved.freshCacheMs) {
    throw new RangeError('staleCacheMs must be greater than or equal to freshCacheMs')
  }
  return resolved
}

/** Register one discovery-only tool and one loopback read RPC. */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config)
  const catalog = new AwesomeDshCatalogClient(resolved)
  const resolver = new CapabilityResolver(catalog, resolved)
  ctx.effect(
    () => () => catalog.dispose(),
    'capability-resolver: catalog client',
  )
  ctx.effect(
    () => ctx.tools.register(createCapabilityResolveTool(ctx, resolver, resolved)),
    'capability-resolver: tool',
  )
  ctx.effect(
    () => registerCapabilityResolverRpc(ctx, async (request, signal) => {
      const current = await collectCurrentCapabilities(ctx, undefined, signal)
      return resolver.resolve(request, current, signal)
    }),
    'capability-resolver: loopback rpc',
  )
}

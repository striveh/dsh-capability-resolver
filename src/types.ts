/** Public JSON and wire types for the capability resolver. */

/** Fixed catalog origin. User task text is never appended to this URL. */
export const CAPABILITY_CATALOG_URL = 'https://awesome-dsh-plugin.com/plugins.json' as const

/** Logical Connection channel owned by this plugin. */
export const CAPABILITY_RESOLVER_RPC_CHANNEL = '/dsh-capability-resolver' as const

/** Sole read-only method on the resolver channel. */
export const CAPABILITY_RESOLVER_RPC_ENDPOINT = 'resolve' as const

/** Version of the public resolver response. */
export const CAPABILITY_RESOLVER_SCHEMA_VERSION = 1 as const

/** Maximum UTF-8 JSON bytes returned by one resolver operation. */
export const MAX_CAPABILITY_RESOLUTION_BYTES = 524_288

/** Stable catalog provider identity. */
export const CAPABILITY_PROVIDER_ID = 'awesome-dsh-plugin' as const

/** Locale variants supplied by the fixed catalog. */
export type CapabilityLocale = 'en' | 'zh'

/** A user need resolved locally against the already downloaded catalog. */
export interface CapabilityResolveRequest {
  readonly task: string
  readonly locale?: CapabilityLocale
  readonly limit?: number
}

/** High-level resolver outcome. */
export type CapabilityDecision = 'use-existing' | 'consider-plugin' | 'no-match' | 'unavailable'

/** Existing DSH capability that may already address the task. */
export interface PossibleCurrentCapabilityMatch {
  readonly kind: 'plugin' | 'tool' | 'skill'
  readonly name: string
  readonly description?: string
  readonly enabled?: boolean
  readonly matchedTerms: readonly string[]
}

/** Safe copy-only npm installation input from the catalog. */
export interface CapabilityInstallSpec {
  readonly kind: 'npm'
  readonly packageName: string
}

/** Loader entry corresponding to one catalog candidate. */
export interface ConfiguredPluginEvidence {
  readonly entryId: string
  readonly moduleName: string
  readonly enabled: boolean
}

/** Catalog fields that contributed to a local lexical match. */
export type CapabilityMatchedField = 'name' | 'owner' | 'category' | 'description' | 'npm'

/** Verifiable catalog links and local match evidence for one candidate. */
export interface CapabilityCandidateEvidence {
  readonly providerId: typeof CAPABILITY_PROVIDER_ID
  readonly catalogUrl: typeof CAPABILITY_CATALOG_URL
  readonly catalogPageUrl: string
  readonly repositoryUrl: string
  readonly matchedFields: readonly CapabilityMatchedField[]
  readonly matchedTerms: readonly string[]
  readonly stars?: number
  readonly downloads?: number
  readonly added?: string
}

/** One locally ranked community catalog candidate. */
export interface CapabilityCandidate {
  readonly name: string
  readonly owner: string
  readonly category: string
  readonly description: string
  readonly installSpec?: CapabilityInstallSpec
  readonly configured?: ConfiguredPluginEvidence
  readonly evidence: CapabilityCandidateEvidence
}

/** State of the fixed catalog source used for a resolution. */
export interface CapabilityCatalogSourceState {
  readonly providerId: typeof CAPABILITY_PROVIDER_ID
  readonly catalogUrl: typeof CAPABILITY_CATALOG_URL
  readonly fetchedAt?: string
  readonly updatedAt?: string
  readonly stale: boolean
  readonly warning?: string
  readonly invalidEntryCount?: number
}

/** Aggregate catalog availability and completeness. */
export interface CapabilityCatalogState {
  readonly complete: boolean
  readonly stale: boolean
  readonly warning?: string
  readonly sources: readonly CapabilityCatalogSourceState[]
}

/** Complete loopback RPC response retained for the deeply validating browser UI. */
export interface CapabilityResolution {
  readonly schemaVersion: typeof CAPABILITY_RESOLVER_SCHEMA_VERSION
  readonly decision: CapabilityDecision
  readonly possibleCurrentMatches: readonly PossibleCurrentCapabilityMatch[]
  readonly currentSkillsComplete: boolean
  readonly candidates: readonly CapabilityCandidate[]
  readonly catalog: CapabilityCatalogState
  readonly privacy: {
    readonly catalogRequestContainsTask: false
  }
}

/** Resolved, validated deployment limits used by the Host implementation. */
export interface ResolvedCapabilityResolverConfig {
  readonly freshCacheMs: number
  readonly staleCacheMs: number
  readonly fetchTimeoutMs: number
  readonly maxCatalogBytes: number
  readonly maxCatalogEntries: number
  readonly maxTaskChars: number
  readonly maxResults: number
  readonly maxCurrentMatches: number
  readonly maxDescriptionChars: number
  readonly maxMatchedTerms: number
}

/** Loader facts read directly from the current configured tree. */
export interface ConfiguredPluginInput {
  readonly entryId: string
  readonly moduleName: string
  readonly enabled: boolean
}

/** Tool or skill metadata visible in the current scope. */
export interface CurrentCapabilityInput {
  readonly kind: 'tool' | 'skill'
  readonly name: string
  readonly description: string
}

/** Current-state observation supplied to the pure resolver. */
export interface CurrentCapabilityObservation {
  readonly configuredPlugins: readonly ConfiguredPluginInput[]
  readonly capabilities: readonly CurrentCapabilityInput[]
  readonly skillsComplete: boolean
}

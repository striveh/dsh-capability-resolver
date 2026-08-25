import type {
  ClientConnectionRpc,
  RpcError,
} from '@deepseek-ai/dsh-client-connection/client'
import {
  CAPABILITY_CATALOG_URL,
  CAPABILITY_PROVIDER_ID,
  CAPABILITY_RESOLVER_RPC_CHANNEL,
  CAPABILITY_RESOLVER_RPC_ENDPOINT,
  CAPABILITY_RESOLVER_SCHEMA_VERSION,
  MAX_CAPABILITY_RESOLUTION_BYTES,
  type CapabilityCandidate,
  type CapabilityCandidateEvidence,
  type CapabilityCatalogSourceState,
  type CapabilityMatchedField,
  type CapabilityResolution,
  type CapabilityResolveRequest,
  type PossibleCurrentCapabilityMatch,
} from '../types.ts'

const DECISIONS = new Set(['use-existing', 'consider-plugin', 'no-match', 'unavailable'])
const CURRENT_KINDS = new Set(['plugin', 'tool', 'skill'])
const MATCHED_FIELDS = new Set(['name', 'owner', 'category', 'description', 'npm'])
const NPM_ATOM = '[a-z0-9](?:[a-z0-9._~-]*[a-z0-9])?'
const SAFE_NPM_PACKAGE = new RegExp(`^(?:${NPM_ATOM}|@${NPM_ATOM}\/${NPM_ATOM})$`)

const CANONICAL_REPOSITORY = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+)(?:\/tree\/(main|master)\/(.+))?$/
const MAX_CANDIDATES = 50
const MAX_CURRENT_MATCHES = 50
const MAX_MATCHED_FIELDS = 5
const MAX_MATCHED_TERMS = 50
const MAX_CATALOG_SOURCES = 1
const MAX_CANDIDATE_NAME_CODE_UNITS = 200
const MAX_CURRENT_NAME_CHARS = 512
const MAX_CATEGORY_CHARS = 120
const MAX_DESCRIPTION_CHARS = 4_000
const MAX_MATCHED_TERM_CHARS = 80
const MAX_REPOSITORY_NAME_CODE_UNITS = 100
const MAX_REPOSITORY_PATH_CHARS = 512
const MAX_REPOSITORY_SEGMENT_CODE_UNITS = 100

/**
 * Recheck the Host's canonical repository and catalog-page identity before rendering links.
 * @param owner - candidate owner that must equal the GitHub URL owner.
 * @param repositoryUrl - candidate GitHub repository or accepted monorepo URL.
 * @param catalogPageUrl - awesome-dsh-plugin page derived from the same identity.
 * @returns both unchanged canonical URLs, or `undefined` when either value is forged.
 */
export function parseCanonicalCandidateLinks(
  owner: string,
  repositoryUrl: string,
  catalogPageUrl: string,
): { readonly repositoryUrl: string; readonly catalogPageUrl: string } | undefined {
  const match = CANONICAL_REPOSITORY.exec(repositoryUrl)
  if (match === null || match[1] !== owner || match[2] === undefined) return undefined
  const repositoryName = match[2]
  if (repositoryName.length > MAX_REPOSITORY_NAME_CODE_UNITS || repositoryName.endsWith('.git')) {
    return undefined
  }
  const repositoryPath = match[4]
  if (repositoryPath !== undefined) {
    if (Array.from(repositoryPath).length > MAX_REPOSITORY_PATH_CHARS) return undefined
    const segments = repositoryPath.split('/')
    if (segments.length === 0 || segments.some(segment => segment.length === 0
      || segment.length > MAX_REPOSITORY_SEGMENT_CODE_UNITS
      || segment === '.' || segment === '..'
      || !/^[A-Za-z0-9._-]+$/.test(segment))) {
      return undefined
    }
  }
  const suffix = repositoryPath === undefined ? '' : `--${repositoryPath.split('/').join('-')}`
  const expectedPage = `https://awesome-dsh-plugin.com/p/${owner}/${repositoryName}${suffix}/`
  return catalogPageUrl === expectedPage ? { repositoryUrl, catalogPageUrl } : undefined
}

/** Error returned through a valid Connection RPC failure envelope. */
export class CapabilityResolverRpcError extends Error {
  readonly code: RpcError['code']

  /** @param error - validated Connection RPC error. */
  constructor(error: RpcError) {
    super(error.message)
    this.name = 'CapabilityResolverRpcError'
    this.code = error.code
  }
}

/** Typed client consumed by the Settings page controller. */
export interface CapabilityResolverClient {
  /**
   * Resolve one task through the loopback-only Host channel.
   * @param request - task, active locale, and optional result bound.
   * @param signal - optional caller cancellation.
   * @returns a deeply validated capability resolution.
   */
  resolve(request: CapabilityResolveRequest, signal?: AbortSignal): Promise<CapabilityResolution>
}

function expectRecord(value: unknown, subject: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}`)
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, subject: string): string {
  if (typeof value !== 'string') throw new Error(`dsh-capability-resolver: invalid ${subject}`)
  return value
}

function expectCodeUnitBoundedString(value: unknown, subject: string, maxLength: number): string {
  const result = expectString(value, subject)
  if (result.length > maxLength) throw new Error(`dsh-capability-resolver: oversized ${subject}`)
  return result
}

function expectCharacterBoundedString(value: unknown, subject: string, maxLength: number): string {
  const result = expectString(value, subject)
  if (Array.from(result).length > maxLength) {
    throw new Error(`dsh-capability-resolver: oversized ${subject}`)
  }
  return result
}

function expectBoolean(value: unknown, subject: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`dsh-capability-resolver: invalid ${subject}`)
  return value
}

function expectArray(value: unknown, subject: string, maxItems: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`dsh-capability-resolver: invalid ${subject}`)
  if (value.length > maxItems) throw new Error(`dsh-capability-resolver: oversized ${subject}`)
  return value
}

function optionalString(value: unknown, subject: string): string | undefined {
  return value === undefined ? undefined : expectString(value, subject)
}

function optionalBoolean(value: unknown, subject: string): boolean | undefined {
  return value === undefined ? undefined : expectBoolean(value, subject)
}

function optionalCount(value: unknown, subject: string): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}`)
  }
  return value as number
}

function stringArray(
  value: unknown,
  subject: string,
  maxItems: number,
  maxItemChars: number,
): readonly string[] {
  return expectArray(value, subject, maxItems)
    .map((entry, index) => expectCharacterBoundedString(
      entry,
      `${subject}[${index}]`,
      maxItemChars,
    ))
}

function matchedFieldArray(value: unknown, subject: string): readonly CapabilityMatchedField[] {
  return expectArray(value, subject, MAX_MATCHED_FIELDS).map((entry, index) => {
    const field = expectString(entry, `${subject}[${index}]`)
    if (!MATCHED_FIELDS.has(field)) {
      throw new Error(`dsh-capability-resolver: invalid ${subject}[${index}]`)
    }
    return field as CapabilityMatchedField
  })
}

function validateCurrentMatch(value: unknown, subject: string): PossibleCurrentCapabilityMatch {
  const input = expectRecord(value, subject)
  const kind = expectString(input.kind, `${subject}.kind`)
  if (!CURRENT_KINDS.has(kind)) throw new Error(`dsh-capability-resolver: invalid ${subject}.kind`)
  expectCharacterBoundedString(input.name, `${subject}.name`, MAX_CURRENT_NAME_CHARS)
  if (input.description !== undefined) {
    expectCharacterBoundedString(input.description, `${subject}.description`, MAX_DESCRIPTION_CHARS)
  }
  optionalBoolean(input.enabled, `${subject}.enabled`)
  stringArray(input.matchedTerms, `${subject}.matchedTerms`, MAX_MATCHED_TERMS, MAX_MATCHED_TERM_CHARS)
  return input as unknown as PossibleCurrentCapabilityMatch
}

function validateEvidence(value: unknown, subject: string, owner: string): CapabilityCandidateEvidence {
  const input = expectRecord(value, subject)
  if (input.providerId !== CAPABILITY_PROVIDER_ID) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}.providerId`)
  }
  if (input.catalogUrl !== CAPABILITY_CATALOG_URL) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}.catalogUrl`)
  }
  const catalogPageUrl = expectString(input.catalogPageUrl, `${subject}.catalogPageUrl`)
  const repositoryUrl = expectString(input.repositoryUrl, `${subject}.repositoryUrl`)
  if (parseCanonicalCandidateLinks(owner, repositoryUrl, catalogPageUrl) === undefined) {
    throw new Error(`dsh-capability-resolver: unsafe ${subject} link identity`)
  }
  matchedFieldArray(input.matchedFields, `${subject}.matchedFields`)
  stringArray(input.matchedTerms, `${subject}.matchedTerms`, MAX_MATCHED_TERMS, MAX_MATCHED_TERM_CHARS)
  optionalCount(input.stars, `${subject}.stars`)
  optionalCount(input.downloads, `${subject}.downloads`)
  const added = optionalString(input.added, `${subject}.added`)
  if (added !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(added)) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}.added`)
  }
  return input as unknown as CapabilityCandidateEvidence
}

function validateCandidate(value: unknown, subject: string): CapabilityCandidate {
  const input = expectRecord(value, subject)
  expectCodeUnitBoundedString(input.name, `${subject}.name`, MAX_CANDIDATE_NAME_CODE_UNITS)
  const owner = expectString(input.owner, `${subject}.owner`)
  expectCharacterBoundedString(input.category, `${subject}.category`, MAX_CATEGORY_CHARS)
  expectCharacterBoundedString(input.description, `${subject}.description`, MAX_DESCRIPTION_CHARS)
  validateEvidence(input.evidence, `${subject}.evidence`, owner)
  if (input.installSpec !== undefined) {
    const installSpec = expectRecord(input.installSpec, `${subject}.installSpec`)
    if (installSpec.kind !== 'npm') {
      throw new Error(`dsh-capability-resolver: invalid ${subject}.installSpec.kind`)
    }
    const packageName = expectString(installSpec.packageName, `${subject}.installSpec.packageName`)
    if (packageName.length > 214 || packageName !== packageName.toLowerCase()
      || !SAFE_NPM_PACKAGE.test(packageName)) {
      throw new Error(`dsh-capability-resolver: unsafe ${subject}.installSpec.packageName`)
    }
  }
  if (input.configured !== undefined) {
    const configured = expectRecord(input.configured, `${subject}.configured`)
    expectString(configured.entryId, `${subject}.configured.entryId`)
    expectString(configured.moduleName, `${subject}.configured.moduleName`)
    expectBoolean(configured.enabled, `${subject}.configured.enabled`)
  }
  return input as unknown as CapabilityCandidate
}

function validateSource(value: unknown, subject: string): CapabilityCatalogSourceState {
  const input = expectRecord(value, subject)
  if (input.providerId !== CAPABILITY_PROVIDER_ID) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}.providerId`)
  }
  if (input.catalogUrl !== CAPABILITY_CATALOG_URL) {
    throw new Error(`dsh-capability-resolver: invalid ${subject}.catalogUrl`)
  }
  optionalString(input.fetchedAt, `${subject}.fetchedAt`)
  optionalString(input.updatedAt, `${subject}.updatedAt`)
  expectBoolean(input.stale, `${subject}.stale`)
  optionalCount(input.invalidEntryCount, `${subject}.invalidEntryCount`)
  optionalString(input.warning, `${subject}.warning`)
  return input as unknown as CapabilityCatalogSourceState
}

/**
 * Validate the complete untrusted RPC value before any field reaches the UI.
 * @param value - decoded Connection response value.
 * @returns the validated resolution.
 */
export function validateCapabilityResolution(value: unknown): CapabilityResolution {
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new Error('dsh-capability-resolver: invalid resolve response JSON')
  }
  if (serialized === undefined
    || new TextEncoder().encode(serialized).byteLength > MAX_CAPABILITY_RESOLUTION_BYTES) {
    throw new Error('dsh-capability-resolver: oversized resolve response')
  }
  const input = expectRecord(value, 'resolve response')
  if (input.schemaVersion !== CAPABILITY_RESOLVER_SCHEMA_VERSION) {
    throw new Error('dsh-capability-resolver: unsupported resolve response.schemaVersion')
  }
  const decision = expectString(input.decision, 'resolve response.decision')
  if (!DECISIONS.has(decision)) {
    throw new Error('dsh-capability-resolver: invalid resolve response.decision')
  }
  expectArray(input.possibleCurrentMatches, 'resolve response.possibleCurrentMatches', MAX_CURRENT_MATCHES)
    .forEach((match, index) => {
      validateCurrentMatch(match, `resolve response.possibleCurrentMatches[${index}]`)
    })
  expectBoolean(input.currentSkillsComplete, 'resolve response.currentSkillsComplete')
  expectArray(input.candidates, 'resolve response.candidates', MAX_CANDIDATES)
    .forEach((candidate, index) => {
      validateCandidate(candidate, `resolve response.candidates[${index}]`)
    })
  const catalog = expectRecord(input.catalog, 'resolve response.catalog')
  expectBoolean(catalog.complete, 'resolve response.catalog.complete')
  expectBoolean(catalog.stale, 'resolve response.catalog.stale')
  optionalString(catalog.warning, 'resolve response.catalog.warning')
  expectArray(catalog.sources, 'resolve response.catalog.sources', MAX_CATALOG_SOURCES)
    .forEach((source, index) => {
      validateSource(source, `resolve response.catalog.sources[${index}]`)
    })
  const privacy = expectRecord(input.privacy, 'resolve response.privacy')
  if (privacy.catalogRequestContainsTask !== false) {
    throw new Error('dsh-capability-resolver: invalid resolve response.privacy.catalogRequestContainsTask')
  }
  return input as unknown as CapabilityResolution
}

/**
 * Bind the generic Connection transport to the capability resolver channel.
 * @param rpc - browser Connection RPC service.
 * @returns typed read-only resolver client.
 */
export function createCapabilityResolverClient(rpc: ClientConnectionRpc): CapabilityResolverClient {
  return {
    async resolve(request, signal) {
      const result = await rpc.call(
        CAPABILITY_RESOLVER_RPC_CHANNEL,
        CAPABILITY_RESOLVER_RPC_ENDPOINT,
        request,
        signal,
      )
      if (!result.ok) throw new CapabilityResolverRpcError(result.error)
      return validateCapabilityResolution(result.value)
    },
  }
}

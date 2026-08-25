import type { CapabilityResolution } from '../types.ts'

/** Immutable state published by the browser-local resolver controller. */
export type CapabilityResolverView =
  | { readonly status: 'idle' }
  | { readonly status: 'resolving'; readonly task: string }
  | { readonly status: 'ready'; readonly task: string; readonly resolution: CapabilityResolution }
  | { readonly status: 'error'; readonly task: string }

/** Candidate projected by one validated Host resolution. */
export type CapabilityCandidate = CapabilityResolution['candidates'][number]

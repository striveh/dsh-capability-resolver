/** Pure orchestration of local current-state and fixed-catalog matching. */
import type { AwesomeDshCatalogClient } from './catalog.ts';
import { type CapabilityResolution, type CapabilityResolveRequest, type CurrentCapabilityObservation, type ResolvedCapabilityResolverConfig } from './types.ts';
/** Invalid user-controlled resolver input. */
export declare class CapabilityRequestError extends Error {
    constructor(message: string);
}
/** Validate and normalize a request at the local operation boundary. */
export declare function resolveCapabilityRequest(request: CapabilityResolveRequest, config: ResolvedCapabilityResolverConfig): Required<Pick<CapabilityResolveRequest, 'task' | 'locale' | 'limit'>>;
/** Read-only resolver backed by one fixed-origin catalog client. */
export declare class CapabilityResolver {
    #private;
    constructor(catalog: AwesomeDshCatalogClient, config: ResolvedCapabilityResolverConfig);
    /** Resolve one need locally after the fixed catalog download completes. */
    resolve(request: CapabilityResolveRequest, current: CurrentCapabilityObservation, signal: AbortSignal): Promise<CapabilityResolution>;
}
//# sourceMappingURL=resolver.d.ts.map
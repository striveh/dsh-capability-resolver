/** Fixed-origin catalog fetch, validation, and bounded last-good caching. */
import { type CapabilityCatalogState, type CapabilityMatchedField, type ResolvedCapabilityResolverConfig } from './types.ts';
/** Validated catalog record used only for local ranking. */
export interface CatalogPluginRecord {
    readonly name: string;
    readonly owner: string;
    readonly repositoryName: string;
    readonly repositoryUrl: string;
    readonly repositoryPath?: string;
    readonly catalogPageUrl: string;
    readonly category: string;
    readonly categoryLabels: {
        readonly en: string;
        readonly zh: string;
    };
    readonly description: {
        readonly en: string;
        readonly zh: string;
    };
    readonly npmPackage?: string;
    readonly stars?: number;
    readonly downloads?: number;
    readonly added?: string;
}
/** Catalog entries plus the public availability state for one resolution. */
export interface CatalogObservation {
    readonly plugins: readonly CatalogPluginRecord[];
    readonly state: CapabilityCatalogState;
}
/** Fetch-compatible dependency accepted by the catalog client. */
export type CatalogFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
/** Strict GitHub repository identity admitted from one catalog row. */
export interface CatalogRepositoryIdentity {
    readonly repositoryName: string;
    readonly repositoryUrl: string;
    readonly repositoryPath?: string;
}
/**
 * Validate the sole repository URL grammar accepted from the catalog.
 * @param value - untrusted catalog URL value.
 * @param owner - catalog owner that must equal the URL owner.
 * @returns a strict repository identity, or `undefined` when validation fails.
 */
export declare function parseCatalogRepository(value: unknown, owner: string): CatalogRepositoryIdentity | undefined;
/**
 * Validate the sole catalog detail-page URL admitted for one repository identity.
 * @param value - untrusted catalog page value.
 * @param owner - validated repository owner.
 * @param repositoryName - validated repository name.
 * @param repositoryPath - optional validated monorepo path.
 * @returns the canonical catalog page URL, or `undefined` when validation fails.
 */
export declare function parseCatalogPage(value: unknown, owner: string, repositoryName: string, repositoryPath: string | undefined): string | undefined;
/** Return a strict npm package name suitable only for display/copy. */
export declare function parseNpmPackageName(value: unknown): string | undefined;
/**
 * Fixed-origin client with bounded reads, one shared refresh, and a time-limited last-good cache.
 * Caller cancellation stops only that observer while another observer still waits for the refresh.
 */
export declare class AwesomeDshCatalogClient {
    #private;
    constructor(config: ResolvedCapabilityResolverConfig, fetchImplementation?: CatalogFetch, now?: () => number);
    /** Fetch or reuse the catalog without placing task text in the request. */
    observe(signal: AbortSignal): Promise<CatalogObservation>;
    /** Abort the shared refresh, clear cached data, and wait until refresh work has settled. */
    dispose(): Promise<void>;
}
/** Field order shared by deterministic ranking and JSON evidence. */
export declare const MATCHED_FIELD_ORDER: readonly CapabilityMatchedField[];
//# sourceMappingURL=catalog.d.ts.map
/** Independent Host + tool + loopback RPC capability resolver plugin. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ResolvedCapabilityResolverConfig } from './types.ts';
export * from './catalog.ts';
export * from './ranking.ts';
export * from './resolver.ts';
export * from './rpc.ts';
export * from './tool.ts';
export * from './types.ts';
/** Cordis plugin identity. */
export declare const name = "capability-resolver";
/** Published rc.2 Host services required by both discovery entry points. */
export declare const inject: string[];
export declare const DEFAULT_FRESH_CACHE_MS = 900000;
export declare const DEFAULT_STALE_CACHE_MS = 86400000;
export declare const DEFAULT_FETCH_TIMEOUT_MS = 5000;
export declare const DEFAULT_MAX_CATALOG_BYTES = 8388608;
export declare const DEFAULT_MAX_CATALOG_ENTRIES = 5000;
export declare const DEFAULT_MAX_TASK_CHARS = 2000;
export declare const DEFAULT_MAX_RESULTS = 8;
export declare const DEFAULT_MAX_CURRENT_MATCHES = 8;
export declare const DEFAULT_MAX_DESCRIPTION_CHARS = 600;
export declare const DEFAULT_MAX_MATCHED_TERMS = 12;
/** Loader configuration for bounded catalog and result processing. */
export interface Config {
    readonly freshCacheMs?: number;
    readonly staleCacheMs?: number;
    readonly fetchTimeoutMs?: number;
    readonly maxCatalogBytes?: number;
    readonly maxCatalogEntries?: number;
    readonly maxTaskChars?: number;
    readonly maxResults?: number;
    readonly maxCurrentMatches?: number;
    readonly maxDescriptionChars?: number;
    readonly maxMatchedTerms?: number;
}
/** Loader-visible schema. The catalog URL is intentionally not configurable. */
export declare const Config: z<Config>;
/** Resolve defaults for direct apply calls and reject inconsistent cache ages. */
export declare function resolveConfig(config?: Config): ResolvedCapabilityResolverConfig;
/** Register one discovery-only tool and one loopback read RPC. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map
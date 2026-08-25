/** Deterministic local lexical ranking for catalog and current capabilities. */
import { type CatalogPluginRecord } from './catalog.ts';
import { type CapabilityCandidate, type CapabilityLocale, type ConfiguredPluginInput, type CurrentCapabilityObservation, type PossibleCurrentCapabilityMatch, type ResolvedCapabilityResolverConfig } from './types.ts';
/** Rank validated catalog records without any network access. */
export declare function rankCatalogCandidates(task: string, locale: CapabilityLocale, plugins: readonly CatalogPluginRecord[], configuredPlugins: readonly ConfiguredPluginInput[], limit: number, config: ResolvedCapabilityResolverConfig): CapabilityCandidate[];
/** Rank bounded, explicitly possible current matches without claiming capability equivalence. */
export declare function rankPossibleCurrentMatches(task: string, current: CurrentCapabilityObservation, catalog: readonly CatalogPluginRecord[], config: ResolvedCapabilityResolverConfig): PossibleCurrentCapabilityMatch[];
//# sourceMappingURL=ranking.d.ts.map
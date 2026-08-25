/** Pure orchestration of local current-state and fixed-catalog matching. */
import { rankCatalogCandidates, rankPossibleCurrentMatches } from "./ranking.js";
import { MAX_CAPABILITY_RESOLUTION_BYTES, CAPABILITY_RESOLVER_SCHEMA_VERSION, } from "./types.js";
const OUTPUT_LIMIT_WARNING = 'Resolution lists were truncated to the fixed JSON output limit.';
/** Invalid user-controlled resolver input. */
export class CapabilityRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CapabilityRequestError';
    }
}
function localeFor(request, task) {
    if (request.locale !== undefined)
        return request.locale;
    return /\p{Script=Han}/u.test(task) ? 'zh' : 'en';
}
function jsonBytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
function catalogWithOutputWarning(state) {
    return {
        ...state,
        warning: state.warning === undefined ? OUTPUT_LIMIT_WARNING : `${state.warning} ${OUTPUT_LIMIT_WARNING}`,
    };
}
function boundedResolution(decision, possibleCurrentMatches, currentSkillsComplete, candidates, catalog) {
    const boundedMatches = [...possibleCurrentMatches];
    const boundedCandidates = [...candidates];
    let outputCatalog = catalog;
    const create = () => ({
        schemaVersion: CAPABILITY_RESOLVER_SCHEMA_VERSION,
        decision,
        possibleCurrentMatches: boundedMatches,
        currentSkillsComplete,
        candidates: boundedCandidates,
        catalog: outputCatalog,
        privacy: { catalogRequestContainsTask: false },
    });
    let value = create();
    if (jsonBytes(value) <= MAX_CAPABILITY_RESOLUTION_BYTES)
        return value;
    outputCatalog = catalogWithOutputWarning(catalog);
    const supportingMatch = decision === 'use-existing'
        ? boundedMatches.find(match => match.kind !== 'plugin' || match.enabled === true)
        : undefined;
    const minimumCandidates = decision === 'consider-plugin' ? 1 : 0;
    while (jsonBytes(value = create()) > MAX_CAPABILITY_RESOLUTION_BYTES) {
        if (boundedCandidates.length > minimumCandidates) {
            boundedCandidates.pop();
            continue;
        }
        let removableMatch = -1;
        for (let index = boundedMatches.length - 1; index >= 0; index -= 1) {
            if (boundedMatches[index] !== supportingMatch) {
                removableMatch = index;
                break;
            }
        }
        if (removableMatch >= 0) {
            boundedMatches.splice(removableMatch, 1);
            continue;
        }
        throw new RangeError('capability resolution construction exceeded its fixed JSON output limit');
    }
    return value;
}
/** Validate and normalize a request at the local operation boundary. */
export function resolveCapabilityRequest(request, config) {
    const task = request.task.trim();
    if (task.length === 0)
        throw new CapabilityRequestError('task must not be empty');
    if (Array.from(task).length > config.maxTaskChars) {
        throw new CapabilityRequestError(`task must contain at most ${config.maxTaskChars} characters`);
    }
    if (request.locale !== undefined && request.locale !== 'en' && request.locale !== 'zh') {
        throw new CapabilityRequestError('locale must be en or zh');
    }
    const limit = request.limit ?? config.maxResults;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > config.maxResults) {
        throw new CapabilityRequestError(`limit must be an integer from 1 to ${config.maxResults}`);
    }
    return { task, locale: localeFor(request, task), limit };
}
/** Read-only resolver backed by one fixed-origin catalog client. */
export class CapabilityResolver {
    #catalog;
    #config;
    constructor(catalog, config) {
        this.#catalog = catalog;
        this.#config = config;
    }
    /** Resolve one need locally after the fixed catalog download completes. */
    async resolve(request, current, signal) {
        const resolved = resolveCapabilityRequest(request, this.#config);
        if (signal.aborted)
            throw signal.reason;
        const catalog = await this.#catalog.observe(signal);
        if (signal.aborted)
            throw signal.reason;
        const candidates = rankCatalogCandidates(resolved.task, resolved.locale, catalog.plugins, current.configuredPlugins, resolved.limit, this.#config);
        const possibleCurrentMatches = rankPossibleCurrentMatches(resolved.task, current, catalog.plugins, this.#config);
        const currentMatch = possibleCurrentMatches.some(match => match.kind !== 'plugin' || match.enabled === true);
        const decision = currentMatch
            ? 'use-existing'
            : candidates.length > 0
                ? 'consider-plugin'
                : catalog.state.complete
                    ? 'no-match'
                    : 'unavailable';
        return boundedResolution(decision, possibleCurrentMatches, current.skillsComplete, candidates, catalog.state);
    }
}
//# sourceMappingURL=resolver.js.map
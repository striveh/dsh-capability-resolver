/** Fixed-origin catalog fetch, validation, and bounded last-good caching. */
import { CAPABILITY_CATALOG_URL, CAPABILITY_PROVIDER_ID, } from "./types.js";
const CATALOG_NAME = 'awesome-dsh-plugin';
const CATALOG_SITE_URL = 'https://awesome-dsh-plugin.com';
const CATALOG_SOURCE_URL = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const MAX_CATEGORY_LABEL_CHARS = 120;
const MAX_REPOSITORY_PATH_CHARS = 512;
class CatalogLoadError extends Error {
}
function hasOnlyKeys(record, keys) {
    const allowed = new Set(keys);
    return Object.keys(record).every(key => allowed.has(key)) && keys.every(key => key in record);
}
function objectValue(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function nonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
function optionalCount(value) {
    if (value === null || value === undefined)
        return undefined;
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
function truncate(value, maxChars) {
    const characters = Array.from(value);
    return characters.length <= maxChars ? value : characters.slice(0, maxChars).join('');
}
function hasAtMostCharacters(value, maxChars) {
    return Array.from(value).length <= maxChars;
}
function parseUpdatedAt(value) {
    if (typeof value !== 'string')
        return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const timestamp = Date.parse(`${value}T00:00:00.000Z`);
        return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
            ? value
            : undefined;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
        return undefined;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? value : undefined;
}
/**
 * Validate the sole repository URL grammar accepted from the catalog.
 * @param value - untrusted catalog URL value.
 * @param owner - catalog owner that must equal the URL owner.
 * @returns a strict repository identity, or `undefined` when validation fails.
 */
export function parseCatalogRepository(value, owner) {
    const url = nonEmptyString(value);
    if (url === undefined)
        return undefined;
    const match = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+)(?:\/tree\/(main|master)\/(.+))?$/.exec(url);
    if (match === null || match[1] !== owner || match[2] === undefined)
        return undefined;
    const repositoryName = match[2];
    if (repositoryName.length > 100 || repositoryName.endsWith('.git'))
        return undefined;
    const repositoryPath = match[4];
    if (repositoryPath === undefined)
        return { repositoryName, repositoryUrl: url };
    if (!hasAtMostCharacters(repositoryPath, MAX_REPOSITORY_PATH_CHARS))
        return undefined;
    const segments = repositoryPath.split('/');
    if (segments.length === 0 || segments.some(segment => segment.length === 0
        || segment.length > 100 || segment === '.' || segment === '..'
        || !/^[A-Za-z0-9._-]+$/.test(segment))) {
        return undefined;
    }
    return { repositoryName, repositoryUrl: url, repositoryPath };
}
/**
 * Validate the sole catalog detail-page URL admitted for one repository identity.
 * @param value - untrusted catalog page value.
 * @param owner - validated repository owner.
 * @param repositoryName - validated repository name.
 * @param repositoryPath - optional validated monorepo path.
 * @returns the canonical catalog page URL, or `undefined` when validation fails.
 */
export function parseCatalogPage(value, owner, repositoryName, repositoryPath) {
    const page = nonEmptyString(value);
    if (page === undefined)
        return undefined;
    const suffix = repositoryPath === undefined ? '' : `--${repositoryPath.split('/').join('-')}`;
    const expected = `${CATALOG_SITE_URL}/p/${owner}/${repositoryName}${suffix}/`;
    return page === expected ? page : undefined;
}
/** Return a strict npm package name suitable only for display/copy. */
export function parseNpmPackageName(value) {
    if (value === null || value === undefined)
        return undefined;
    if (typeof value !== 'string' || value.length === 0 || value.length > 214 || value !== value.toLowerCase()) {
        return undefined;
    }
    const atom = '[a-z0-9](?:[a-z0-9._~-]*[a-z0-9])?';
    const unscoped = new RegExp(`^${atom}$`);
    const scoped = new RegExp(`^@${atom}\/${atom}$`);
    return unscoped.test(value) || scoped.test(value) ? value : undefined;
}
function parsePlugin(value, categories, maxDescriptionChars) {
    const record = objectValue(value);
    if (record === undefined)
        return undefined;
    const name = nonEmptyString(record.name);
    const owner = nonEmptyString(record.owner);
    const category = nonEmptyString(record.category);
    const description = objectValue(record.description);
    const en = nonEmptyString(description?.en);
    const zh = nonEmptyString(description?.zh);
    if (name === undefined || name.length > 200
        || owner === undefined || owner.length > 39
        || category === undefined || !categories.has(category)
        || en === undefined || zh === undefined) {
        return undefined;
    }
    const repository = parseCatalogRepository(record.url, owner);
    if (repository === undefined)
        return undefined;
    const catalogPageUrl = parseCatalogPage(record.page, owner, repository.repositoryName, repository.repositoryPath);
    if (catalogPageUrl === undefined)
        return undefined;
    const categoryLabels = categories.get(category);
    if (categoryLabels === undefined)
        return undefined;
    const stars = optionalCount(record.stars);
    const downloads = optionalCount(record.downloads);
    if ((record.stars !== null && record.stars !== undefined && stars === undefined)
        || (record.downloads !== null && record.downloads !== undefined && downloads === undefined)) {
        return undefined;
    }
    const added = record.added === undefined ? undefined : nonEmptyString(record.added);
    const npmPackage = parseNpmPackageName(record.npm);
    if (added !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(added))
        return undefined;
    if (record.added !== undefined && added === undefined)
        return undefined;
    return {
        name,
        owner,
        repositoryName: repository.repositoryName,
        repositoryUrl: repository.repositoryUrl,
        ...(repository.repositoryPath === undefined ? {} : { repositoryPath: repository.repositoryPath }),
        catalogPageUrl,
        category,
        categoryLabels,
        description: {
            en: truncate(en, maxDescriptionChars),
            zh: truncate(zh, maxDescriptionChars),
        },
        ...(npmPackage === undefined ? {} : { npmPackage }),
        ...(stars === undefined ? {} : { stars }),
        ...(downloads === undefined ? {} : { downloads }),
        ...(added === undefined ? {} : { added }),
    };
}
function parseCategories(value) {
    const record = objectValue(value);
    if (record === undefined)
        return undefined;
    const result = new Map();
    for (const [key, labelsValue] of Object.entries(record)) {
        const labels = objectValue(labelsValue);
        const en = nonEmptyString(labels?.en);
        const zh = nonEmptyString(labels?.zh);
        if (key.length === 0 || key.length > 100 || labels === undefined
            || !hasOnlyKeys(labels, ['en', 'zh']) || en === undefined || zh === undefined
            || !hasAtMostCharacters(en, MAX_CATEGORY_LABEL_CHARS)
            || !hasAtMostCharacters(zh, MAX_CATEGORY_LABEL_CHARS)) {
            return undefined;
        }
        result.set(key, { en, zh });
    }
    return result.size > 0 ? result : undefined;
}
function parseCatalogJson(text, config, fetchedAtMs) {
    let decoded;
    try {
        decoded = JSON.parse(text);
    }
    catch {
        throw new CatalogLoadError('catalog JSON is invalid');
    }
    const root = objectValue(decoded);
    const categories = parseCategories(root?.categories);
    const plugins = root?.plugins;
    const declaredCount = root?.count;
    const updatedAt = parseUpdatedAt(root?.updated);
    if (root === undefined
        || !hasOnlyKeys(root, ['name', 'url', 'source', 'updated', 'count', 'categories', 'plugins'])
        || root.name !== CATALOG_NAME
        || root.url !== CATALOG_SITE_URL
        || root.source !== CATALOG_SOURCE_URL
        || updatedAt === undefined
        || categories === undefined
        || !Array.isArray(plugins)
        || !Number.isSafeInteger(declaredCount)
        || declaredCount < 0) {
        throw new CatalogLoadError('catalog root is invalid');
    }
    if (plugins.length > config.maxCatalogEntries) {
        throw new CatalogLoadError('catalog entry limit exceeded');
    }
    const valid = [];
    let invalidEntryCount = 0;
    for (const plugin of plugins) {
        const parsed = parsePlugin(plugin, categories, config.maxDescriptionChars);
        if (parsed === undefined)
            invalidEntryCount += 1;
        else
            valid.push(parsed);
    }
    const countMismatch = declaredCount !== plugins.length;
    const warnings = [];
    if (invalidEntryCount > 0)
        warnings.push(`Catalog skipped ${invalidEntryCount} invalid entries.`);
    if (countMismatch)
        warnings.push('Catalog declared count does not match its plugin array.');
    return {
        plugins: valid,
        fetchedAtMs,
        fetchedAt: new Date(fetchedAtMs).toISOString(),
        updatedAt,
        complete: invalidEntryCount === 0 && !countMismatch,
        ...(warnings.length === 0 ? {} : { warning: warnings.join(' ') }),
        invalidEntryCount,
    };
}
async function readBoundedResponse(response, maxBytes, signal) {
    if (!response.ok)
        throw new CatalogLoadError('catalog HTTP response failed');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json' && contentType?.endsWith('+json') !== true) {
        throw new CatalogLoadError('catalog content type is not JSON');
    }
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
        const length = Number(declaredLength);
        if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
            throw new CatalogLoadError('catalog byte limit exceeded');
        }
    }
    if (response.body === null)
        throw new CatalogLoadError('catalog response has no body');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            if (signal.aborted)
                throw signal.reason;
            const next = await reader.read();
            if (next.done)
                break;
            total += next.value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new CatalogLoadError('catalog byte limit exceeded');
            }
            chunks.push(next.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    catch {
        throw new CatalogLoadError('catalog is not valid UTF-8');
    }
}
function sourceState(cache, stale, warning) {
    const combinedWarning = [cache.warning, warning].filter((value) => value !== undefined).join(' ');
    return {
        complete: cache.complete && !stale,
        stale,
        ...(combinedWarning.length === 0 ? {} : { warning: combinedWarning }),
        sources: [{
                providerId: CAPABILITY_PROVIDER_ID,
                catalogUrl: CAPABILITY_CATALOG_URL,
                fetchedAt: cache.fetchedAt,
                updatedAt: cache.updatedAt,
                stale,
                ...(combinedWarning.length === 0 ? {} : { warning: combinedWarning }),
                ...(cache.invalidEntryCount === 0 ? {} : { invalidEntryCount: cache.invalidEntryCount }),
            }],
    };
}
function unavailableState(warning) {
    return {
        complete: false,
        stale: false,
        warning,
        sources: [{
                providerId: CAPABILITY_PROVIDER_ID,
                catalogUrl: CAPABILITY_CATALOG_URL,
                stale: false,
                warning,
            }],
    };
}
/**
 * Fixed-origin client with bounded reads, one shared refresh, and a time-limited last-good cache.
 * Caller cancellation stops only that observer while another observer still waits for the refresh.
 */
export class AwesomeDshCatalogClient {
    #config;
    #fetch;
    #now;
    #cache;
    #inFlight;
    #disposed = false;
    #disposePromise;
    #disposedReason = new DOMException('Capability catalog client was disposed', 'AbortError');
    constructor(config, fetchImplementation = globalThis.fetch.bind(globalThis), now = Date.now) {
        this.#config = config;
        this.#fetch = fetchImplementation;
        this.#now = now;
    }
    async #load(fetchedAtMs, signal) {
        const timeout = setTimeout(() => {
            if (!signal.aborted) {
                const controller = this.#inFlight?.controller;
                if (controller?.signal === signal) {
                    controller.abort(new DOMException('Catalog request timed out', 'TimeoutError'));
                }
            }
        }, this.#config.fetchTimeoutMs);
        try {
            const response = await this.#fetch(CAPABILITY_CATALOG_URL, {
                method: 'GET',
                headers: { accept: 'application/json' },
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                redirect: 'error',
                signal,
            });
            const text = await readBoundedResponse(response, this.#config.maxCatalogBytes, signal);
            return parseCatalogJson(text, this.#config, fetchedAtMs);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    #startFlight(fetchedAtMs) {
        const controller = new AbortController();
        const flight = {
            controller,
            promise: Promise.resolve(undefined),
            waiters: 0,
            settled: false,
        };
        flight.promise = this.#load(fetchedAtMs, controller.signal)
            .then((loaded) => {
            if (!this.#disposed && !controller.signal.aborted && this.#inFlight === flight) {
                this.#cache = loaded;
            }
            return loaded;
        })
            .finally(() => {
            flight.settled = true;
            if (this.#inFlight === flight)
                this.#inFlight = undefined;
        });
        this.#inFlight = flight;
        return flight;
    }
    #leaveFlight(flight) {
        flight.waiters -= 1;
        if (flight.waiters !== 0 || flight.settled || this.#inFlight !== flight)
            return;
        this.#inFlight = undefined;
        flight.controller.abort(new DOMException('Catalog request has no remaining observers', 'AbortError'));
    }
    #joinFlight(flight, signal) {
        flight.waiters += 1;
        return new Promise((resolve, reject) => {
            let completed = false;
            const finish = (settle) => {
                if (completed)
                    return;
                completed = true;
                signal.removeEventListener('abort', onAbort);
                this.#leaveFlight(flight);
                settle();
            };
            const onAbort = () => {
                finish(() => reject(signal.reason ?? new DOMException('Operation aborted', 'AbortError')));
            };
            signal.addEventListener('abort', onAbort, { once: true });
            flight.promise.then(loaded => finish(() => resolve(loaded)), error => finish(() => reject(error)));
            if (signal.aborted)
                onAbort();
        });
    }
    /** Fetch or reuse the catalog without placing task text in the request. */
    async observe(signal) {
        if (signal.aborted)
            throw signal.reason;
        if (this.#disposed)
            throw this.#disposedReason;
        const now = this.#now();
        if (this.#cache !== undefined && now - this.#cache.fetchedAtMs < this.#config.freshCacheMs) {
            return { plugins: this.#cache.plugins, state: sourceState(this.#cache, false) };
        }
        const flight = this.#inFlight ?? this.#startFlight(now);
        try {
            const loaded = await this.#joinFlight(flight, signal);
            if (signal.aborted)
                throw signal.reason;
            if (this.#disposed)
                throw this.#disposedReason;
            return { plugins: loaded.plugins, state: sourceState(loaded, false) };
        }
        catch {
            if (signal.aborted)
                throw signal.reason;
            if (this.#disposed)
                throw this.#disposedReason;
            const warning = 'The fixed capability catalog is currently unavailable.';
            if (this.#cache !== undefined && this.#now() - this.#cache.fetchedAtMs <= this.#config.staleCacheMs) {
                return { plugins: this.#cache.plugins, state: sourceState(this.#cache, true, warning) };
            }
            this.#cache = undefined;
            return { plugins: [], state: unavailableState(warning) };
        }
    }
    /** Abort the shared refresh, clear cached data, and wait until refresh work has settled. */
    dispose() {
        if (this.#disposePromise !== undefined)
            return this.#disposePromise;
        this.#disposed = true;
        this.#cache = undefined;
        const flight = this.#inFlight;
        this.#inFlight = undefined;
        if (flight === undefined) {
            this.#disposePromise = Promise.resolve();
            return this.#disposePromise;
        }
        flight.controller.abort(this.#disposedReason);
        this.#disposePromise = flight.promise.then(() => undefined, () => undefined);
        return this.#disposePromise;
    }
}
/** Field order shared by deterministic ranking and JSON evidence. */
export const MATCHED_FIELD_ORDER = [
    'name',
    'npm',
    'category',
    'description',
    'owner',
];
//# sourceMappingURL=catalog.js.map
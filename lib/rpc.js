/** Loopback-only Connection RPC for the read-only resolver. */
import { CapabilityRequestError } from "./resolver.js";
import { CAPABILITY_RESOLVER_RPC_CHANNEL, CAPABILITY_RESOLVER_RPC_ENDPOINT, } from "./types.js";
function badRequest(message) {
    return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } };
}
function cancelled() {
    return {
        ok: false,
        error: { code: 'cancelled', message: 'Capability resolution was cancelled', details: {} },
    };
}
function internalFailure() {
    return {
        ok: false,
        error: { code: 'internal', message: 'Capability resolution failed', details: {} },
    };
}
function parseRequest(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return undefined;
    const record = value;
    let keys;
    try {
        keys = Object.keys(record);
    }
    catch {
        return undefined;
    }
    if (keys.some(key => key !== 'task' && key !== 'locale' && key !== 'limit'))
        return undefined;
    let task;
    let locale;
    let limit;
    try {
        task = record.task;
        locale = record.locale;
        limit = record.limit;
    }
    catch {
        return undefined;
    }
    if (typeof task !== 'string')
        return undefined;
    if (locale !== undefined && locale !== 'en' && locale !== 'zh')
        return undefined;
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
        return undefined;
    return {
        task,
        ...(locale === undefined ? {} : { locale }),
        ...(limit === undefined ? {} : { limit: limit }),
    };
}
/** Build the sole RPC handler without registering a physical route. */
export function createCapabilityResolverRpcHandler(resolve) {
    return async (endpoint, payload, signal) => {
        if (signal.aborted)
            return cancelled();
        if (endpoint !== CAPABILITY_RESOLVER_RPC_ENDPOINT)
            return badRequest('unknown capability resolver endpoint');
        const request = parseRequest(payload);
        if (request === undefined) {
            return badRequest('resolve requires only task and optional locale and limit fields');
        }
        try {
            const value = await resolve(request, signal);
            return signal.aborted ? cancelled() : { ok: true, value };
        }
        catch (error) {
            if (signal.aborted)
                return cancelled();
            if (error instanceof CapabilityRequestError)
                return badRequest(error.message);
            return internalFailure();
        }
    };
}
/** Register the loopback channel and return its asynchronous HMR disposer. */
export function registerCapabilityResolverRpc(ctx, resolve) {
    return ctx.connection.rpc.handle(CAPABILITY_RESOLVER_RPC_CHANNEL, createCapabilityResolverRpcHandler(resolve), { authority: 'loopback' });
}
//# sourceMappingURL=rpc.js.map
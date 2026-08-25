/** Loopback-only Connection RPC for the read-only resolver. */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import { type CapabilityResolution, type CapabilityResolveRequest } from './types.ts';
/** Resolver operation shared by the RPC adapter and tests. */
export type CapabilityResolveOperation = (request: CapabilityResolveRequest, signal: AbortSignal) => Promise<CapabilityResolution>;
/** Build the sole RPC handler without registering a physical route. */
export declare function createCapabilityResolverRpcHandler(resolve: CapabilityResolveOperation): ConnectionRpcHandler;
/** Register the loopback channel and return its asynchronous HMR disposer. */
export declare function registerCapabilityResolverRpc(ctx: Context, resolve: CapabilityResolveOperation): () => Promise<void>;
//# sourceMappingURL=rpc.d.ts.map
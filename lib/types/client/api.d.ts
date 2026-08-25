import type { ClientConnectionRpc, RpcError } from '@deepseek-ai/dsh-client-connection/client';
import { type CapabilityResolution, type CapabilityResolveRequest } from '../types.ts';
/**
 * Recheck the Host's canonical repository and catalog-page identity before rendering links.
 * @param owner - candidate owner that must equal the GitHub URL owner.
 * @param repositoryUrl - candidate GitHub repository or accepted monorepo URL.
 * @param catalogPageUrl - awesome-dsh-plugin page derived from the same identity.
 * @returns both unchanged canonical URLs, or `undefined` when either value is forged.
 */
export declare function parseCanonicalCandidateLinks(owner: string, repositoryUrl: string, catalogPageUrl: string): {
    readonly repositoryUrl: string;
    readonly catalogPageUrl: string;
} | undefined;
/** Error returned through a valid Connection RPC failure envelope. */
export declare class CapabilityResolverRpcError extends Error {
    readonly code: RpcError['code'];
    /** @param error - validated Connection RPC error. */
    constructor(error: RpcError);
}
/** Typed client consumed by the Settings page controller. */
export interface CapabilityResolverClient {
    /**
     * Resolve one task through the loopback-only Host channel.
     * @param request - task, active locale, and optional result bound.
     * @param signal - optional caller cancellation.
     * @returns a deeply validated capability resolution.
     */
    resolve(request: CapabilityResolveRequest, signal?: AbortSignal): Promise<CapabilityResolution>;
}
/**
 * Validate the complete untrusted RPC value before any field reaches the UI.
 * @param value - decoded Connection response value.
 * @returns the validated resolution.
 */
export declare function validateCapabilityResolution(value: unknown): CapabilityResolution;
/**
 * Bind the generic Connection transport to the capability resolver channel.
 * @param rpc - browser Connection RPC service.
 * @returns typed read-only resolver client.
 */
export declare function createCapabilityResolverClient(rpc: ClientConnectionRpc): CapabilityResolverClient;
//# sourceMappingURL=api.d.ts.map
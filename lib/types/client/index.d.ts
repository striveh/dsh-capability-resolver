/** Need-first capability discovery page contributed to Web Plugins settings. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type CapabilityResolverLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Need-first capability discovery and catalog-evidence copy. */
        'settings.capabilityResolver': CapabilityResolverLocaleKey;
    }
}
/** Required browser services for the Settings contribution and local RPC carrier. */
export declare const inject: string[];
/** Register the read-only capability discovery page in Plugins settings. */
export declare function apply(ctx: ClientContext): void;
export type { CapabilityResolverClient } from './api.ts';
export { CapabilityResolverRpcError, createCapabilityResolverClient, validateCapabilityResolution, } from './api.ts';
export { CAPABILITY_RESOLVER_RPC_CHANNEL, CAPABILITY_RESOLVER_RPC_ENDPOINT, } from '../types.ts';
export { CapabilityResolverSettingsTab } from './CapabilityResolverSettingsTab.tsx';
//# sourceMappingURL=index.d.ts.map
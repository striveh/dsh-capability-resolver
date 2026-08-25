import { type ReactNode } from 'react';
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { CapabilityResolverView } from './model.ts';
import type { createCapabilityResolverViewStore } from './store.ts';
/** Registration-side business face bound by the slot renderer. */
export interface CapabilityResolverSettingsTabInjected {
    /** Browser-local state that survives Settings component remounts. */
    hooks: {
        resolver: HostObservable<CapabilityResolverView>;
    };
    /** Start one read-only local resolution. */
    resolve: (task: string) => Promise<void>;
    /** Retry the last admitted task. */
    retry: () => Promise<void>;
    /** Cancel the active request. */
    cancel: () => void;
}
/** Full props assembled for the capability discovery tab. */
export type CapabilityResolverSettingsTabProps = PropsRuntime<'settings.plugins.tab'> & PropsStore<ReturnType<typeof createCapabilityResolverViewStore>> & PropsLocale<'settings.capabilityResolver'> & InjectFace<CapabilityResolverSettingsTabInjected>;
/** Render the read-only, need-first capability discovery tab. */
export declare function CapabilityResolverSettingsTab({ actions, cancel, resolve, retry, t, useResolver, useStore, }: CapabilityResolverSettingsTabProps): ReactNode;
//# sourceMappingURL=CapabilityResolverSettingsTab.d.ts.map
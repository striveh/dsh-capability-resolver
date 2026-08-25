import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { CapabilityResolution } from '../types.ts';
import type { CapabilityResolverView } from './model.ts';
/** Adapter that reads locale and crosses the local Connection RPC boundary. */
export type ResolveCapability = (task: string, signal: AbortSignal) => Promise<CapabilityResolution>;
/**
 * Apply-lifecycle-owned resolution state. The instance survives Settings view
 * remounts, owns cancellation, and refuses superseded request completions.
 */
export declare class CapabilityResolverController implements HostObservable<CapabilityResolverView> {
    private readonly resolveCapability;
    private view;
    private readonly listeners;
    private active;
    private generation;
    private lastTask;
    private disposed;
    /** @param resolveCapability - local Host adapter owned by browser plugin apply. */
    constructor(resolveCapability: ResolveCapability);
    /** @returns the current immutable view. */
    getSnapshot: () => CapabilityResolverView;
    /**
     * Subscribe to view replacement.
     * @param listener - synchronous store observer.
     * @returns disposer for this subscription.
     */
    subscribe: (listener: () => void) => (() => void);
    /**
     * Resolve one non-empty task, cancelling and superseding older work.
     * @param task - user task trimmed before it reaches the local Host.
     */
    resolve: (task: string) => Promise<void>;
    /** Retry the last admitted task with the locale active at retry time. */
    retry: () => Promise<void>;
    /** Cancel active work and return to the explanatory first state. */
    cancel: () => void;
    /** Abort active work and drop subscribers when the browser plugin unloads. */
    dispose(): void;
    private publish;
}
//# sourceMappingURL=controller.d.ts.map
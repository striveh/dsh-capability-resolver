import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client';
/** Remount-surviving interaction state for the discovery page. */
export interface CapabilityResolverViewState {
    /** Controlled capability-task draft. */
    taskDraft: string;
    /** The one open evidence disclosure in the single-column list. */
    expandedCandidateId: string | null;
    /** Clipboard feedback for the last candidate copy attempt. */
    copyFeedback: {
        readonly candidateId: string;
        readonly ok: boolean;
    } | null;
}
type CapabilityResolverViewActions = {
    setTaskDraft: (draft: CapabilityResolverViewState, value: string) => void;
    toggleCandidate: (draft: CapabilityResolverViewState, candidateId: string) => void;
    resetResultUi: (draft: CapabilityResolverViewState) => void;
    setCopyFeedback: (draft: CapabilityResolverViewState, candidateId: string, ok: boolean) => void;
};
/** @returns the root-scoped store installed with the Settings tab. */
export declare function createCapabilityResolverViewStore(): EngineStoreHandle<CapabilityResolverViewState, CapabilityResolverViewActions>;
export {};
//# sourceMappingURL=store.d.ts.map
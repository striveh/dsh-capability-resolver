import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Remount-surviving interaction state for the discovery page. */
export interface CapabilityResolverViewState {
  /** Controlled capability-task draft. */
  taskDraft: string
  /** The one open evidence disclosure in the single-column list. */
  expandedCandidateId: string | null
  /** Clipboard feedback for the last candidate copy attempt. */
  copyFeedback: { readonly candidateId: string; readonly ok: boolean } | null
}

type CapabilityResolverViewActions = {
  setTaskDraft: (draft: CapabilityResolverViewState, value: string) => void
  toggleCandidate: (draft: CapabilityResolverViewState, candidateId: string) => void
  resetResultUi: (draft: CapabilityResolverViewState) => void
  setCopyFeedback: (draft: CapabilityResolverViewState, candidateId: string, ok: boolean) => void
}

/** @returns the root-scoped store installed with the Settings tab. */
export function createCapabilityResolverViewStore(): EngineStoreHandle<
  CapabilityResolverViewState,
  CapabilityResolverViewActions
> {
  return defineStore({
    init: (): CapabilityResolverViewState => ({
      taskDraft: '',
      expandedCandidateId: null,
      copyFeedback: null,
    }),
    actions: {
      setTaskDraft: (draft, value: string) => { draft.taskDraft = value },
      toggleCandidate: (draft, candidateId: string) => {
        draft.expandedCandidateId = draft.expandedCandidateId === candidateId ? null : candidateId
      },
      resetResultUi: (draft) => {
        draft.expandedCandidateId = null
        draft.copyFeedback = null
      },
      setCopyFeedback: (draft, candidateId: string, ok: boolean) => {
        draft.copyFeedback = { candidateId, ok }
      },
    },
  })
}

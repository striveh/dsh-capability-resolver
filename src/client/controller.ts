import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { CapabilityResolution } from '../types.ts'
import type { CapabilityResolverView } from './model.ts'

const IDLE: CapabilityResolverView = Object.freeze({ status: 'idle' })

/** Adapter that reads locale and crosses the local Connection RPC boundary. */
export type ResolveCapability = (
  task: string,
  signal: AbortSignal,
) => Promise<CapabilityResolution>

/**
 * Apply-lifecycle-owned resolution state. The instance survives Settings view
 * remounts, owns cancellation, and refuses superseded request completions.
 */
export class CapabilityResolverController implements HostObservable<CapabilityResolverView> {
  private view: CapabilityResolverView = IDLE
  private readonly listeners = new Set<() => void>()
  private active: AbortController | undefined
  private generation = 0
  private lastTask: string | undefined
  private disposed = false

  /** @param resolveCapability - local Host adapter owned by browser plugin apply. */
  constructor(private readonly resolveCapability: ResolveCapability) {}

  /** @returns the current immutable view. */
  getSnapshot = (): CapabilityResolverView => this.view

  /**
   * Subscribe to view replacement.
   * @param listener - synchronous store observer.
   * @returns disposer for this subscription.
   */
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Resolve one non-empty task, cancelling and superseding older work.
   * @param task - user task trimmed before it reaches the local Host.
   */
  resolve = async (task: string): Promise<void> => {
    const normalized = task.trim()
    if (normalized.length === 0 || this.disposed) return
    this.lastTask = normalized
    const generation = ++this.generation
    this.active?.abort()
    const active = new AbortController()
    this.active = active
    this.publish({ status: 'resolving', task: normalized })

    try {
      const resolution = await Promise.resolve()
        .then(() => this.resolveCapability(normalized, active.signal))
      if (generation !== this.generation) return
      this.active = undefined
      this.publish({ status: 'ready', task: normalized, resolution })
    } catch {
      if (generation !== this.generation) return
      this.active = undefined
      this.publish({ status: 'error', task: normalized })
    }
  }

  /** Retry the last admitted task with the locale active at retry time. */
  retry = async (): Promise<void> => {
    if (this.lastTask !== undefined) await this.resolve(this.lastTask)
  }

  /** Cancel active work and return to the explanatory first state. */
  cancel = (): void => {
    if (this.disposed || this.active === undefined) return
    ++this.generation
    this.active.abort()
    this.active = undefined
    this.publish(IDLE)
  }

  /** Abort active work and drop subscribers when the browser plugin unloads. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    ++this.generation
    this.active?.abort()
    this.active = undefined
    this.listeners.clear()
  }

  private publish(view: CapabilityResolverView): void {
    this.view = view
    for (const listener of this.listeners) listener()
  }
}

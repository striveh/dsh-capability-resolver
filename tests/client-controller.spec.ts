import { describe, expect, it, vi } from 'vitest'
import {
  CAPABILITY_RESOLVER_SCHEMA_VERSION,
  type CapabilityResolution,
} from '../src/types.ts'
import { CapabilityResolverController } from '../src/client/controller.ts'

function resolution(decision: CapabilityResolution['decision'] = 'no-match'): CapabilityResolution {
  return {
    schemaVersion: CAPABILITY_RESOLVER_SCHEMA_VERSION,
    decision,
    possibleCurrentMatches: [],
    currentSkillsComplete: true,
    candidates: [],
    catalog: { complete: true, stale: false, sources: [] },
    privacy: { catalogRequestContainsTask: false },
  }
}

describe('CapabilityResolverController', () => {
  it('starts cold, admits a trimmed explicit task, and retries the last task', async () => {
    const resolve = vi.fn(() => Promise.resolve(resolution()))
    const controller = new CapabilityResolverController(resolve)
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    expect(controller.getSnapshot()).toEqual({ status: 'idle' })
    await controller.retry()
    await controller.resolve('   ')
    expect(resolve).not.toHaveBeenCalled()
    await controller.resolve('  transcribe a meeting  ')
    expect(resolve).toHaveBeenCalledWith('transcribe a meeting', expect.any(AbortSignal))
    expect(controller.getSnapshot()).toEqual({
      status: 'ready',
      task: 'transcribe a meeting',
      resolution: resolution(),
    })
    await controller.retry()
    expect(resolve).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    controller.dispose()
  })

  it('aborts an older request and ignores its late success', async () => {
    const first = Promise.withResolvers<CapabilityResolution>()
    const second = Promise.withResolvers<CapabilityResolution>()
    const signals: AbortSignal[] = []
    const resolve = vi.fn((_task: string, signal: AbortSignal) => {
      signals.push(signal)
      return signals.length === 1 ? first.promise : second.promise
    })
    const controller = new CapabilityResolverController(resolve)

    const oldRequest = controller.resolve('old task')
    await Promise.resolve()
    const newRequest = controller.resolve('new task')
    await Promise.resolve()
    expect(signals[0]?.aborted).toBe(true)
    second.resolve(resolution('consider-plugin'))
    await newRequest
    first.resolve(resolution('use-existing'))
    await oldRequest

    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      task: 'new task',
      resolution: { decision: 'consider-plugin' },
    })
    controller.dispose()
  })

  it('ignores a rejected superseded request', async () => {
    const first = Promise.withResolvers<CapabilityResolution>()
    const second = Promise.withResolvers<CapabilityResolution>()
    const queue = [first, second]
    const controller = new CapabilityResolverController(() => queue.shift()!.promise)

    const oldRequest = controller.resolve('old')
    await Promise.resolve()
    const newRequest = controller.resolve('new')
    await Promise.resolve()
    first.reject(new Error('late private failure'))
    second.resolve(resolution())
    await Promise.all([oldRequest, newRequest])

    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', task: 'new' })
    controller.dispose()
  })

  it('contains failures, supports cancellation, and refuses work after disposal', async () => {
    const pending = Promise.withResolvers<CapabilityResolution>()
    const resolve = vi.fn(() => pending.promise)
    const controller = new CapabilityResolverController(resolve)
    controller.cancel()
    const request = controller.resolve('task')
    await Promise.resolve()
    const signal = resolve.mock.calls[0]?.[1]
    controller.cancel()
    expect(signal?.aborted).toBe(true)
    expect(controller.getSnapshot()).toEqual({ status: 'idle' })
    pending.resolve(resolution())
    await request
    expect(controller.getSnapshot()).toEqual({ status: 'idle' })

    const failed = new CapabilityResolverController(() => Promise.reject(new Error('private detail')))
    await failed.resolve('task')
    expect(failed.getSnapshot()).toEqual({ status: 'error', task: 'task' })
    failed.dispose()
    failed.dispose()
    failed.cancel()
    const afterDispose = vi.fn()
    const stop = failed.subscribe(afterDispose)
    stop()
    await failed.resolve('ignored')
    expect(afterDispose).not.toHaveBeenCalled()
    expect(resolve).toHaveBeenCalledOnce()
  })

  it('aborts on disposal and ignores the later reply', async () => {
    const pending = Promise.withResolvers<CapabilityResolution>()
    let signal: AbortSignal | undefined
    const controller = new CapabilityResolverController((_task, activeSignal) => {
      signal = activeSignal
      return pending.promise
    })
    const request = controller.resolve('late')
    await Promise.resolve()
    controller.dispose()
    expect(signal?.aborted).toBe(true)
    pending.resolve(resolution())
    await request
    expect(controller.getSnapshot()).toMatchObject({ status: 'resolving', task: 'late' })
  })
})

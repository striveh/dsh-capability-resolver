import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { describe, expect, it, vi } from 'vitest'
import { CapabilityRequestError } from '../src/resolver.ts'
import {
  createCapabilityResolverRpcHandler,
  registerCapabilityResolverRpc,
} from '../src/rpc.ts'
import {
  CAPABILITY_RESOLVER_RPC_CHANNEL,
  CAPABILITY_RESOLVER_RPC_ENDPOINT,
  CAPABILITY_RESOLVER_SCHEMA_VERSION,
  type CapabilityResolution,
} from '../src/types.ts'

function resolution(): CapabilityResolution {
  return {
    schemaVersion: CAPABILITY_RESOLVER_SCHEMA_VERSION,
    decision: 'no-match',
    possibleCurrentMatches: [],
    currentSkillsComplete: false,
    candidates: [],
    catalog: { complete: true, stale: false, sources: [] },
    privacy: { catalogRequestContainsTask: false },
  }
}

describe('loopback capability resolver RPC', () => {
  it('accepts only the resolve endpoint and exact request fields', async () => {
    const resolve = vi.fn().mockResolvedValue(resolution())
    const handler = createCapabilityResolverRpcHandler(resolve)
    const signal = new AbortController().signal

    await expect(handler(
      CAPABILITY_RESOLVER_RPC_ENDPOINT,
      { task: 'transcribe', locale: 'en', limit: 3 },
      signal,
    )).resolves.toEqual({ ok: true, value: resolution() })
    expect(resolve).toHaveBeenCalledWith(
      { task: 'transcribe', locale: 'en', limit: 3 },
      signal,
    )
    await expect(handler('other', { task: 'x' }, signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
    await expect(handler('resolve', { task: 'x', query: 'must not leave host' }, signal))
      .resolves.toMatchObject({ ok: false, error: { code: 'bad-request' } })
  })

  it('maps request, cancellation, and unexpected failures without leaking internals', async () => {
    const signal = new AbortController().signal
    const invalid = createCapabilityResolverRpcHandler(async () => {
      throw new CapabilityRequestError('task is invalid')
    })
    await expect(invalid('resolve', { task: 'x' }, signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'bad-request', message: 'task is invalid' },
    })

    const internal = createCapabilityResolverRpcHandler(async () => {
      throw new Error('private failure detail')
    })
    const failure = await internal('resolve', { task: 'x' }, signal)
    expect(failure).toMatchObject({ ok: false, error: { code: 'internal' } })
    expect(JSON.stringify(failure)).not.toContain('private failure detail')

    const controller = new AbortController()
    controller.abort(new Error('private abort detail'))
    await expect(internal('resolve', { task: 'x' }, controller.signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    })
  })

  it('registers the fixed channel as loopback and returns the Connection disposer', () => {
    const dispose = vi.fn(async () => {})
    const handle = vi.fn((_channel, _handler, _options) => dispose)
    const ctx = { connection: { rpc: { handle } } } as unknown as Context
    const resolve = vi.fn(async () => resolution())

    expect(registerCapabilityResolverRpc(ctx, resolve)).toBe(dispose)
    expect(handle).toHaveBeenCalledWith(
      CAPABILITY_RESOLVER_RPC_CHANNEL,
      expect.any(Function),
      { authority: 'loopback' },
    )
    const registered = handle.mock.calls[0]?.[1] as ConnectionRpcHandler
    expect(registered).toBeTypeOf('function')
  })
})

/** Loopback-only Connection RPC for the read-only resolver. */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { CapabilityRequestError } from './resolver.ts'
import {
  CAPABILITY_RESOLVER_RPC_CHANNEL,
  CAPABILITY_RESOLVER_RPC_ENDPOINT,
  type CapabilityResolution,
  type CapabilityResolveRequest,
} from './types.ts'

/** Resolver operation shared by the RPC adapter and tests. */
export type CapabilityResolveOperation = (
  request: CapabilityResolveRequest,
  signal: AbortSignal,
) => Promise<CapabilityResolution>

type HandlerResult = Awaited<ReturnType<ConnectionRpcHandler>>

function badRequest(message: string): HandlerResult {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
}

function cancelled(): HandlerResult {
  return {
    ok: false,
    error: { code: 'cancelled', message: 'Capability resolution was cancelled', details: {} },
  }
}

function internalFailure(): HandlerResult {
  return {
    ok: false,
    error: { code: 'internal', message: 'Capability resolution failed', details: {} },
  }
}

function parseRequest(value: unknown): CapabilityResolveRequest | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  let keys: string[]
  try {
    keys = Object.keys(record)
  } catch {
    return undefined
  }
  if (keys.some(key => key !== 'task' && key !== 'locale' && key !== 'limit')) return undefined
  let task: unknown
  let locale: unknown
  let limit: unknown
  try {
    task = record.task
    locale = record.locale
    limit = record.limit
  } catch {
    return undefined
  }
  if (typeof task !== 'string') return undefined
  if (locale !== undefined && locale !== 'en' && locale !== 'zh') return undefined
  if (limit !== undefined && (!Number.isSafeInteger(limit) || (limit as number) < 1)) return undefined
  return {
    task,
    ...(locale === undefined ? {} : { locale }),
    ...(limit === undefined ? {} : { limit: limit as number }),
  }
}

/** Build the sole RPC handler without registering a physical route. */
export function createCapabilityResolverRpcHandler(resolve: CapabilityResolveOperation): ConnectionRpcHandler {
  return async (endpoint, payload, signal) => {
    if (signal.aborted) return cancelled()
    if (endpoint !== CAPABILITY_RESOLVER_RPC_ENDPOINT) return badRequest('unknown capability resolver endpoint')
    const request = parseRequest(payload)
    if (request === undefined) {
      return badRequest('resolve requires only task and optional locale and limit fields')
    }
    try {
      const value = await resolve(request, signal)
      return signal.aborted ? cancelled() : { ok: true, value }
    } catch (error: unknown) {
      if (signal.aborted) return cancelled()
      if (error instanceof CapabilityRequestError) return badRequest(error.message)
      return internalFailure()
    }
  }
}

/** Register the loopback channel and return its asynchronous HMR disposer. */
export function registerCapabilityResolverRpc(
  ctx: Context,
  resolve: CapabilityResolveOperation,
): () => Promise<void> {
  return ctx.connection.rpc.handle(
    CAPABILITY_RESOLVER_RPC_CHANNEL,
    createCapabilityResolverRpcHandler(resolve),
    { authority: 'loopback' },
  )
}

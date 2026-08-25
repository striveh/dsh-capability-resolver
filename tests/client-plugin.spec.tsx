// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { resolveSlotLabel, SlotCore, type StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import {
  CAPABILITY_RESOLVER_RPC_CHANNEL,
  CAPABILITY_RESOLVER_RPC_ENDPOINT,
  CAPABILITY_RESOLVER_SCHEMA_VERSION,
  type CapabilityResolution,
} from '../src/types.ts'
import { apply, inject } from '../src/client/index.ts'
import { CapabilityResolverSettingsTab } from '../src/client/CapabilityResolverSettingsTab.tsx'
import type { CapabilityResolverSettingsTabInjected } from '../src/client/CapabilityResolverSettingsTab.tsx'

afterEach(() => { vi.restoreAllMocks() })

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  defineStore: () => ({ create: () => ({}) }),
}))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: () => null,
  IconChevronDownOutline14: () => null,
  Pill: () => null,
  StateDot: () => null,
  writeClipboard: () => Promise.resolve(false),
}))

function resolution(): CapabilityResolution {
  return {
    schemaVersion: CAPABILITY_RESOLVER_SCHEMA_VERSION,
    decision: 'no-match',
    possibleCurrentMatches: [],
    currentSkillsComplete: true,
    candidates: [],
    catalog: { complete: true, stale: false, sources: [] },
    privacy: { catalogRequestContainsTask: false },
  }
}

class ConnectionService extends Service {
  /** @param ctx - test service context. @param rpc - deterministic unary carrier. */
  constructor(ctx: Context, readonly rpc: ClientConnectionRpc) {
    super(ctx, 'connection')
  }
}

type LocaleDictionaries = Record<'zh' | 'en', Record<string, string>>

class TestLocaleService extends Service {
  private active: 'zh' | 'en' = 'zh'
  private readonly dictionaries = new Map<string, LocaleDictionaries>()

  /** @param ctx - test service context. */
  constructor(ctx: Context) {
    super(ctx, 'locale')
  }

  bind(namespace: string): (key: string, params?: Record<string, unknown>) => string {
    return (key, params) => {
      const template = this.dictionaries.get(namespace)?.[this.active][key] ?? key
      return template.replace(/\{([^}]+)\}/g, (_match, name: string) => String(params?.[name] ?? `{${name}}`))
    }
  }

  register(namespace: string, dictionaries: LocaleDictionaries): () => void {
    this.dictionaries.set(namespace, dictionaries)
    return () => { this.dictionaries.delete(namespace) }
  }

  getSnapshot(): { readonly active: 'zh' | 'en' } {
    return { active: this.active }
  }

  setLocale(locale: 'zh' | 'en'): void {
    this.active = locale
  }
}

class TestSlotService extends Service {
  private readonly core = new SlotCore()

  /** @param ctx - test service context. */
  constructor(ctx: Context) {
    super(ctx, 'slots')
  }

  register(options: object, component: unknown): () => void {
    const dispose = this.ctx.effect(
      () => this.core.register(options as never, component as never),
      'test slots.register',
    )
    return () => { void dispose() }
  }

  inject(key: string, callback: () => () => void): () => void {
    const dispose = this.ctx.effect(() => {
      let active: (() => void) | undefined
      let epoch = -1
      const reconcile = (): void => {
        const nextEpoch = this.core.declarationEpoch(key)
        if (nextEpoch === epoch) return
        epoch = nextEpoch
        active?.()
        active = this.core.specDynamic(key) === undefined ? undefined : callback()
      }
      const unsubscribe = this.core.subscribeDeclaration(key, reconcile)
      reconcile()
      return () => {
        unsubscribe()
        active?.()
        active = undefined
      }
    }, 'test slots.inject')
    return () => { void dispose() }
  }

  entries(key: string): readonly StoredEntry[] {
    return this.core.entries(key)
  }
}

async function bench() {
  const ctx = new Context()
  const slots = new TestSlotService(ctx)
  const locale = new TestLocaleService(ctx)
  const call = vi.fn<ClientConnectionRpc['call']>()
    .mockResolvedValue({ ok: true, value: resolution() })
  new ConnectionService(ctx, { call })
  return { ctx, locale, call, slots }
}

function declare(slots: TestSlotService): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('capability resolver browser plugin', () => {
  it('declares the exact browser services it uses', () => {
    expect(inject).toEqual(['connection', 'slots', 'locale'])
  })

  it('registers the default discovery tab without resolving and reads locale at call time', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugins.tab')[0]!
    expect(entry.component).toBe(CapabilityResolverSettingsTab)
    expect(entry.options).toMatchObject({ id: 'discover', order: -10 })
    expect(resolveSlotLabel(entry.options.label)).toBe('按需求发现')
    expect(b.call).not.toHaveBeenCalled()

    b.slots.register({
      name: 'settings.plugins.tab',
      id: 'configurable',
      order: 0,
      label: '插件配置',
    } as never, () => null)
    b.slots.register({
      name: 'settings.plugins.tab',
      id: 'all',
      order: 10,
      label: '插件列表',
    } as never, () => null)
    const orderedIds = b.slots.entries('settings.plugins.tab')
      .map(row => ({ id: row.options.id, order: row.options.order ?? 0 }))
      .sort((left, right) => left.order - right.order)
      .map(row => row.id)
    expect(orderedIds).toEqual(['discover', 'configurable', 'all'])

    const face = (entry.inject as unknown as () => CapabilityResolverSettingsTabInjected)()
    await face.resolve('first task')
    expect(b.call).toHaveBeenNthCalledWith(
      1,
      CAPABILITY_RESOLVER_RPC_CHANNEL,
      CAPABILITY_RESOLVER_RPC_ENDPOINT,
      { task: 'first task', locale: 'zh' },
      expect.any(AbortSignal),
    )

    b.locale.setLocale('en')
    expect(resolveSlotLabel(entry.options.label)).toBe('Discover by need')
    await face.resolve('second task')
    expect(b.call).toHaveBeenNthCalledWith(
      2,
      CAPABILITY_RESOLVER_RPC_CHANNEL,
      CAPABILITY_RESOLVER_RPC_ENDPOINT,
      { task: 'second task', locale: 'en' },
      expect.any(AbortSignal),
    )
    await b.ctx.fiber.dispose()
  })

  it('retains controller state across slot-owner remounts and disposes cleanly', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.plugins.tab')).toHaveLength(1) })
    const first = b.slots.entries('settings.plugins.tab')[0]!
    const firstFace = (first.inject as unknown as () => CapabilityResolverSettingsTabInjected)()
    await firstFace.resolve('persistent task')
    expect(firstFace.hooks.resolver.getSnapshot()).toMatchObject({
      status: 'ready',
      task: 'persistent task',
    })

    stop()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.plugins.tab')).toHaveLength(1) })
    const second = b.slots.entries('settings.plugins.tab')[0]!
    const secondFace = (second.inject as unknown as () => CapabilityResolverSettingsTabInjected)()
    expect(secondFace.hooks.resolver).toBe(firstFace.hooks.resolver)
    expect(secondFace.hooks.resolver.getSnapshot()).toMatchObject({
      status: 'ready',
      task: 'persistent task',
    })

    await fiber.dispose()
    expect(b.slots.entries('settings.plugins.tab')).toHaveLength(0)
    await b.ctx.fiber.dispose()
  })
})

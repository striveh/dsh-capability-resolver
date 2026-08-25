// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import {
  CAPABILITY_CATALOG_URL,
  CAPABILITY_PROVIDER_ID,
  CAPABILITY_RESOLVER_SCHEMA_VERSION,
  type CapabilityResolution,
} from '../src/types.ts'
import {
  CapabilityResolverSettingsTab,
  type CapabilityResolverSettingsTabProps,
} from '../src/client/CapabilityResolverSettingsTab.tsx'
import { CapabilityResolverController } from '../src/client/controller.ts'
import { zh, type CapabilityResolverLocaleKey } from '../src/client/locales.ts'
import { createCapabilityResolverViewStore } from '../src/client/store.ts'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  defineStore: (spec: {
    init: () => Record<string, unknown>
    actions: Record<string, (draft: Record<string, unknown>, ...args: unknown[]) => void>
  }) => ({
    create: () => {
      let state = spec.init()
      const listeners = new Set<() => void>()
      const actions = Object.fromEntries(Object.entries(spec.actions).map(([name, action]) => [
        name,
        (...args: unknown[]) => {
          const next = structuredClone(state)
          action(next, ...args)
          state = next
          for (const listener of listeners) listener()
        },
      ]))
      return {
        actions,
        getSnapshot: () => state,
        subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    },
  }),
}))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const { createElement } = await import('react')
  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly children?: ReactNode
    readonly size?: string
    readonly variant?: string
  }
  return {
    Button: ({ children, size: _size, variant: _variant, ...props }: ButtonProps) =>
      createElement('button', props, children),
    IconChevronDownOutline14: (props: Record<string, unknown>) => createElement('span', props),
    Pill: ({ active, children }: { readonly active?: boolean; readonly children?: ReactNode }) =>
      createElement('span', { 'data-active': active }, children),
    StateDot: ({ state }: { readonly state: string }) => createElement('span', { 'data-state': state }),
    writeClipboard: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    },
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function resolution(
  decision: CapabilityResolution['decision'] = 'consider-plugin',
): CapabilityResolution {
  return {
    schemaVersion: CAPABILITY_RESOLVER_SCHEMA_VERSION,
    decision,
    possibleCurrentMatches: [{
      kind: 'plugin',
      name: '@deepseek-ai/dsh-web-search',
      description: '当前 Web 搜索配置。',
      enabled: true,
      matchedTerms: ['搜索'],
    }, {
      kind: 'skill',
      name: 'meeting-transcript',
      matchedTerms: ['会议'],
    }],
    currentSkillsComplete: false,
    candidates: [{
      name: 'Audio helper',
      owner: 'acme',
      category: 'audio',
      description: '把会议录音转成带时间戳的文字。',
      installSpec: { kind: 'npm', packageName: '@acme/dsh-audio' },
      configured: {
        entryId: 'audio',
        moduleName: '@acme/dsh-audio',
        enabled: false,
      },
      evidence: {
        providerId: CAPABILITY_PROVIDER_ID,
        catalogUrl: CAPABILITY_CATALOG_URL,
        catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/dsh-audio/',
        repositoryUrl: 'https://github.com/acme/dsh-audio',
        matchedFields: ['name', 'owner', 'description', 'npm'],
        matchedTerms: ['录音', '文字'],
        stars: 42,
        downloads: 1200,
        added: '2026-08-01',
      },
    }, {
      name: 'Transcript alternative',
      owner: 'acme',
      category: 'audio',
      description: '录音转写备选。',
      evidence: {
        providerId: CAPABILITY_PROVIDER_ID,
        catalogUrl: CAPABILITY_CATALOG_URL,
        catalogPageUrl: 'https://attacker.invalid/p/acme/transcript-alternative/',
        repositoryUrl: 'https://attacker.invalid/acme/transcript-alternative',
        matchedFields: ['description'],
        matchedTerms: [],
      },
    }],
    catalog: {
      complete: true,
      stale: false,
      sources: [{
        providerId: CAPABILITY_PROVIDER_ID,
        catalogUrl: CAPABILITY_CATALOG_URL,
        fetchedAt: '2026-08-24T08:00:00.000Z',
        updatedAt: '2026-08-24T07:30:00.000Z',
        stale: false,
        invalidEntryCount: 2,
      }],
    },
    privacy: { catalogRequestContainsTask: false },
  }
}

function t(key: CapabilityResolverLocaleKey, params?: Record<string, unknown>): string {
  return zh[key].replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params?.[name]
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : `{${name}}`
  })
}

function bindSnapshotSelector<T>(source: HostObservable<T>) {
  return function useSelector<S>(selector: (value: T) => S): S {
    const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
    return selector(snapshot)
  }
}

function mount(
  controller: CapabilityResolverController,
  handle = createCapabilityResolverViewStore(),
) {
  const store = handle.create()
  const props: CapabilityResolverSettingsTabProps = {
    actions: store.actions,
    useStore: bindSnapshotSelector(store),
    useResolver: bindSnapshotSelector(controller),
    resolve: controller.resolve,
    retry: controller.retry,
    cancel: controller.cancel,
    t,
  }
  return { ...render(<CapabilityResolverSettingsTab {...props} />), props, store }
}

function submitTask(task: string): void {
  fireEvent.change(screen.getByLabelText(zh.taskLabel), { target: { value: task } })
  fireEvent.click(screen.getByRole('button', { name: zh.submit }))
}

describe('CapabilityResolverSettingsTab', () => {
  it('makes zero first-load calls and admits only an explicit non-empty submit', async () => {
    const resolve = vi.fn(() => Promise.resolve(resolution()))
    const controller = new CapabilityResolverController(resolve)
    mount(controller)

    expect(resolve).not.toHaveBeenCalled()
    expect(document.querySelector('[data-capability-resolver]')).toBeTruthy()
    expect(screen.getByText(zh.privacy)).toBeTruthy()
    expect(screen.getByText(zh.idleBody)).toBeTruthy()
    fireEvent.submit(screen.getByLabelText(zh.taskLabel).closest('form')!)
    expect(resolve).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: zh.submit }) as HTMLButtonElement).disabled).toBe(true)

    submitTask('  转写会议录音  ')
    await waitFor(() => { expect(resolve).toHaveBeenCalledOnce() })
    expect(resolve.mock.calls[0]?.[0]).toBe('转写会议录音')
    controller.dispose()
  })

  it('renders ranked evidence, current capability caveats, and copy-only npm input', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const controller = new CapabilityResolverController(() => Promise.resolve(resolution()))
    mount(controller)
    submitTask('转写会议录音')

    expect(await screen.findByRole('heading', { name: zh.candidatesTitle })).toBeTruthy()
    expect(screen.getByText('@deepseek-ai/dsh-web-search')).toBeTruthy()
    expect(screen.getByText(zh.kindSkill)).toBeTruthy()
    expect(screen.getByText(zh.currentSkillsIncomplete)).toBeTruthy()
    expect(screen.getAllByText(zh.warningCompatibility)).toHaveLength(2)
    expect(screen.getAllByText(zh.warningSecurity)).toHaveLength(2)
    expect(screen.getByText(t('sourceInvalidEntries', { count: 2 }))).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^安装/ })).toBeNull()

    const candidate = screen.getByRole('heading', { name: 'Audio helper' }).closest('article')!
    expect(within(candidate).getByText(zh.candidateConfiguredDisabled)).toBeTruthy()
    expect(within(candidate).getByText('@acme/dsh-audio')).toBeTruthy()
    const disclosure = within(candidate).getByRole('button', { name: zh.showEvidence })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(disclosure)
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(within(candidate).getByRole('link', { name: 'https://github.com/acme/dsh-audio' })).toBeTruthy()
    expect(within(candidate).getByText(new RegExp(`${zh.fieldDescription}.*${zh.fieldNpm}`))).toBeTruthy()
    fireEvent.click(within(candidate).getByRole('button', { name: zh.copyInstallSpec }))
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith('@acme/dsh-audio') })
    expect(writeText).toHaveBeenCalledOnce()
    expect(within(candidate).getByText(zh.copied)).toBeTruthy()

    const unsafe = screen.getByRole('heading', { name: 'Transcript alternative' }).closest('article')!
    fireEvent.click(within(unsafe).getByRole('button', { name: zh.showEvidence }))
    expect(within(unsafe).queryByRole('link', { name: /attacker\.invalid/ })).toBeNull()
    expect(within(unsafe).getByRole('link', { name: CAPABILITY_CATALOG_URL })).toBeTruthy()
    expect(within(unsafe).getByText(zh.noInstallSpec)).toBeTruthy()
    controller.dispose()
  })

  it('keeps the draft and result across a Settings remount', async () => {
    const controller = new CapabilityResolverController(() => Promise.resolve(resolution()))
    const handle = createCapabilityResolverViewStore()
    const first = mount(controller, handle)
    submitTask('跨重挂载目标')
    await screen.findByRole('heading', { name: zh.candidatesTitle })
    first.unmount()

    const props: CapabilityResolverSettingsTabProps = {
      ...first.props,
      useStore: bindSnapshotSelector(first.store),
      useResolver: bindSnapshotSelector(controller),
    }
    render(<CapabilityResolverSettingsTab {...props} />)
    expect((screen.getByLabelText(zh.taskLabel) as HTMLTextAreaElement).value).toBe('跨重挂载目标')
    expect(screen.getByRole('heading', { name: zh.candidatesTitle })).toBeTruthy()
    controller.dispose()
  })

  it('contains a failure, retains the task, and retries without leaking details', async () => {
    const resolve = vi.fn()
      .mockRejectedValueOnce(new Error('private carrier detail'))
      .mockResolvedValueOnce({
        ...resolution('no-match'),
        possibleCurrentMatches: [],
        currentSkillsComplete: true,
        candidates: [],
      })
    const controller = new CapabilityResolverController(resolve)
    mount(controller)
    submitTask('罕见能力')

    expect((await screen.findByRole('alert')).textContent).toContain(zh.error)
    expect(screen.queryByText('private carrier detail')).toBeNull()
    expect((screen.getByLabelText(zh.taskLabel) as HTMLTextAreaElement).value).toBe('罕见能力')
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(await screen.findByRole('heading', { name: zh.noMatchTitle })).toBeTruthy()
    expect(resolve).toHaveBeenCalledTimes(2)
    controller.dispose()
  })

  it('renders unavailable source state and can cancel an active request', async () => {
    const pending = Promise.withResolvers<CapabilityResolution>()
    const controller = new CapabilityResolverController(() => pending.promise)
    mount(controller)
    submitTask('取消目标')
    expect(await screen.findByRole('status')).toHaveProperty('textContent', zh.resolving)
    fireEvent.click(screen.getByRole('button', { name: zh.cancel }))
    expect(screen.getByText(zh.idleBody)).toBeTruthy()
    pending.resolve(resolution())
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('heading', { name: zh.candidatesTitle })).toBeNull()
    controller.dispose()

    cleanup()
    const unavailableValue: CapabilityResolution = {
      ...resolution('unavailable'),
      possibleCurrentMatches: [],
      currentSkillsComplete: true,
      candidates: [],
      catalog: {
        complete: false,
        stale: true,
        warning: '目录读取失败',
        sources: [{
          providerId: CAPABILITY_PROVIDER_ID,
          catalogUrl: CAPABILITY_CATALOG_URL,
          stale: true,
          warning: 'catalog fetch failed',
        }],
      },
    }
    const unavailable = new CapabilityResolverController(() => Promise.resolve(unavailableValue))
    mount(unavailable)
    submitTask('目录能力')
    expect(await screen.findByRole('heading', { name: zh.unavailableTitle })).toBeTruthy()
    expect(screen.getByText(zh.sourcePartial)).toBeTruthy()
    expect(screen.getByText(zh.sourceStale)).toBeTruthy()
    expect(screen.getByText(zh.sourceWarning)).toBeTruthy()
    expect(screen.queryByText('目录读取失败')).toBeNull()
    expect(screen.queryByText('catalog fetch failed')).toBeNull()
    unavailable.dispose()
  })

  it('reports clipboard denial without altering or executing the package name', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const controller = new CapabilityResolverController(() => Promise.resolve(resolution()))
    mount(controller)
    submitTask('复制目标')
    const candidate = (await screen.findByRole('heading', { name: 'Audio helper' })).closest('article')!
    fireEvent.click(within(candidate).getByRole('button', { name: zh.showEvidence }))
    fireEvent.click(within(candidate).getByRole('button', { name: zh.copyInstallSpec }))

    expect(await within(candidate).findByText(zh.copyFailed)).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith('@acme/dsh-audio')
    controller.dispose()
  })
})

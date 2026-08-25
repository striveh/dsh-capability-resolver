/** Need-first capability discovery page contributed to Web Plugins settings. */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { createCapabilityResolverClient } from './api.ts'
import {
  CapabilityResolverSettingsTab,
  type CapabilityResolverSettingsTabInjected,
} from './CapabilityResolverSettingsTab.tsx'
import { CapabilityResolverController } from './controller.ts'
import { en, zh, type CapabilityResolverLocaleKey } from './locales.ts'
import { createCapabilityResolverViewStore } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Need-first capability discovery and catalog-evidence copy. */
    'settings.capabilityResolver': CapabilityResolverLocaleKey
  }
}

/** Required browser services for the Settings contribution and local RPC carrier. */
export const inject = ['connection', 'slots', 'locale']

/** Register the read-only capability discovery page in Plugins settings. */
export function apply(ctx: ClientContext): void {
  const namespace = 'settings.capabilityResolver'
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'capability-resolver: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const client = createCapabilityResolverClient(connection.rpc)
  const controller = new CapabilityResolverController((task, signal) => {
    const locale = ctx.locale.getSnapshot().active
    return client.resolve({ task, locale }, signal)
  })
  const store = createCapabilityResolverViewStore()
  ctx.effect(() => () => { controller.dispose() }, 'capability-resolver: browser controller')

  const injected = (): CapabilityResolverSettingsTabInjected => ({
    hooks: { resolver: controller },
    resolve: controller.resolve,
    retry: controller.retry,
    cancel: controller.cancel,
  })
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'discover',
    order: -10,
    label: () => t('tab'),
    locale: namespace,
    store,
    inject: injected,
  }, CapabilityResolverSettingsTab))
}

export type { CapabilityResolverClient } from './api.ts'
export {
  CapabilityResolverRpcError,
  createCapabilityResolverClient,
  validateCapabilityResolution,
} from './api.ts'
export {
  CAPABILITY_RESOLVER_RPC_CHANNEL,
  CAPABILITY_RESOLVER_RPC_ENDPOINT,
} from '../types.ts'
export { CapabilityResolverSettingsTab } from './CapabilityResolverSettingsTab.tsx'

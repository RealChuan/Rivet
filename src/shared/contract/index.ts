import { appContract, appOneWayContract } from './app.contract.js'
import { configContract } from './config.contract.js'
import { dialogContract } from './dialog.contract.js'
import { hostKeyContract } from './hostkey.contract.js'
import { protocolContract } from './protocol.contract.js'
import { systemContract } from './system.contract.js'
import { transferContract } from './transfer.contract.js'
import { windowContract, windowOneWayContract } from './window.contract.js'

export { appContract, appOneWayContract } from './app.contract.js'
export { configContract } from './config.contract.js'

export type { ApiOf, ArgsOf, ClientOf, IpcDef, ResultOf } from './define.js'
export { defineContract, defineEvents } from './define.js'
export { dialogContract } from './dialog.contract.js'
export type { Events } from './events.contract.js'
export { hostKeyContract } from './hostkey.contract.js'
export { protocolContract } from './protocol.contract.js'
export { systemContract } from './system.contract.js'
export { transferContract } from './transfer.contract.js'
export { windowContract, windowOneWayContract } from './window.contract.js'

import type { WindowChromeMode } from '../types/window-chrome.js'
import type { ApiOf, EventApi, SendApiOf } from './define.js'
import type { Events } from './events.contract.js'

/** 请求/响应通道。新增请求通道 = 在这里出现一个 key。 */
export const invokeContract = {
  ...appContract,
  ...configContract,
  ...dialogContract,
  ...hostKeyContract,
  ...protocolContract,
  ...systemContract,
  ...transferContract,
  ...windowContract,
} as const

export type InvokeContract = typeof invokeContract

/** 单向通道：只能 `send`，不能 `invoke`。 */
export const oneWayContract = { ...appOneWayContract, ...windowOneWayContract }

export type OneWayContract = typeof oneWayContract

/**
 * preload 暴露的 API：请求方法、单向方法、事件订阅全部由契约派生。
 * `dialog.getPathForFile` 是同步 webUtils 调用，不进契约，单独补一个方法。
 */
export type ElectronAPI = {
  app: ApiOf<'app', InvokeContract> & SendApiOf<'app', OneWayContract> & EventApi<'app', Events>
  protocol: ApiOf<'protocol', InvokeContract> & EventApi<'protocol', Events>
  config: ApiOf<'config', InvokeContract>
  dialog: ApiOf<'dialog', InvokeContract> & { getPathForFile: (file: File) => string }
  hostKey: ApiOf<'hostKey', InvokeContract>
  system: ApiOf<'system', InvokeContract>
  transfer: ApiOf<'transfer', InvokeContract> & EventApi<'transfer', Events>
  window: ApiOf<'window', InvokeContract> &
    SendApiOf<'window', OneWayContract> &
    EventApi<'window', Events>
  env: { windowChrome: WindowChromeMode }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

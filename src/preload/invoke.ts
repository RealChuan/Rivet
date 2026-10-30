import { ipcRenderer } from 'electron'
import type { ArgsOf, InvokeContract, OneWayContract, ResultOf } from '@shared/contract/index.js'

/**
 * 渲染层 → 主进程的请求。
 * IPC 边界本身没有类型，断言集中在这一处，其余调用方全部由契约推导。
 */
export function invoke<K extends keyof InvokeContract>(
  channel: K,
  ...args: ArgsOf<InvokeContract[K]>
): Promise<ResultOf<InvokeContract[K]>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<ResultOf<InvokeContract[K]>>
}

/** 单向通道：主进程用 `ipcMain.on` 注册，因此只能 `send`，不能 `invoke`。 */
export function send<K extends keyof OneWayContract>(
  channel: K,
  ...args: ArgsOf<OneWayContract[K]>
): void {
  ipcRenderer.send(channel, ...args)
}

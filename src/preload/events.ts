import type { z } from 'zod'
import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { eventsContract, type Events } from '@shared/contract/events.contract.js'

/**
 * 用具体对象 + 泛型 key 索引时 TS 会丢失 key 与 payload 的相关性。
 * 契约表保证 key 与 payload 同源，因此这里做唯一一次收窄。
 */
function schemaOf<K extends keyof Events>(channel: K): z.ZodType<Events[K]> {
  return eventsContract[channel].payload as unknown as z.ZodType<Events[K]>
}

/**
 * 订阅主进程事件，返回取消函数。
 * 取消用 `removeListener` 而不是 `removeAllListeners`——后者会误删同通道的其它订阅者。
 */
export function subscribe<K extends keyof Events>(
  channel: K,
  callback: (payload: Events[K]) => void,
): () => void {
  const schema = schemaOf(channel)

  const listener = (_event: IpcRendererEvent, payload: unknown) => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) return
    callback(parsed.data)
  }

  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

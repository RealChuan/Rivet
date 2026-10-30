import { ipcRenderer } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribe } from './events.js'

type Listener = (event: unknown, payload: unknown) => void

interface RendererMock {
  on: { mock: { calls: Array<[string, Listener]> } }
  removeListener: { mock: { calls: Array<[string, Listener]> } }
}

const renderer = ipcRenderer as unknown as RendererMock

beforeEach(() => {
  vi.clearAllMocks()
})

describe('subscribe', () => {
  it('用事件名注册 listener，取消时移除同一个 listener', () => {
    const cb = vi.fn()
    const off = subscribe('app.closeRequested', cb)

    const [channel, listener] = renderer.on.mock.calls[0] ?? []
    expect(channel).toBe('app.closeRequested')
    if (!listener) throw new Error('listener not registered')

    off()

    expect(renderer.removeListener).toHaveBeenCalledWith(channel, listener)
  })

  it('回调收到经过 schema 解析的 payload', () => {
    const cb = vi.fn()
    subscribe('transfer.taskRemoved', cb)

    const [, listener] = renderer.on.mock.calls[0] ?? []
    if (!listener) throw new Error('listener not registered')
    listener({}, { taskId: 't1', extra: true })

    expect(cb).toHaveBeenCalledWith({ taskId: 't1' })
  })

  it('非法 payload 不触发回调', () => {
    const cb = vi.fn()
    subscribe('transfer.taskRemoved', cb)

    const [, listener] = renderer.on.mock.calls[0] ?? []
    if (!listener) throw new Error('listener not registered')
    listener({}, { taskId: 42 })

    expect(cb).not.toHaveBeenCalled()
  })

  it('带对象 payload 的事件可以正常回调', () => {
    const cb = vi.fn()
    subscribe('app.closeRequested', cb)

    const [, listener] = renderer.on.mock.calls[0] ?? []
    if (!listener) throw new Error('listener not registered')
    listener({}, { reason: 'quit' })

    expect(cb).toHaveBeenCalledWith({ reason: 'quit' })
  })
})

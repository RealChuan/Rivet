import { describe, expect, it, vi } from 'vitest'
import { forwardAbort } from './abort.js'

describe('forwardAbort', () => {
  it('abort 时只调用一次 onAbort', () => {
    const controller = new AbortController()
    const onAbort = vi.fn()

    forwardAbort(controller.signal, onAbort)
    controller.abort()

    expect(onAbort).toHaveBeenCalledTimes(1)
  })

  it('清理后 abort 不再回调', () => {
    const controller = new AbortController()
    const onAbort = vi.fn()

    const dispose = forwardAbort(controller.signal, onAbort)
    dispose()
    controller.abort()

    expect(onAbort).not.toHaveBeenCalled()
  })

  it('signal 为 undefined 时返回可调用的空清理函数', () => {
    expect(() => forwardAbort(undefined, () => {})()).not.toThrow()
  })

  it('signal 已中止时立即回调一次', () => {
    const controller = new AbortController()
    controller.abort()
    const onAbort = vi.fn()

    forwardAbort(controller.signal, onAbort)

    expect(onAbort).toHaveBeenCalledTimes(1)
  })
})

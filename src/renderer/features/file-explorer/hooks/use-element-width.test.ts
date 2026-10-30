import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useElementWidth } from './use-element-width.js'

let observerCallback: ResizeObserverCallback | null = null

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observerCallback = callback
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

afterEach(() => {
  observerCallback = null
  vi.unstubAllGlobals()
})

describe('useElementWidth', () => {
  it('初始读取 clientWidth，观察回调更新宽度', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const element = document.createElement('div')
    Object.defineProperty(element, 'clientWidth', { value: 320, configurable: true })

    const ref = { current: element }
    const { result } = renderHook(() => useElementWidth(ref))
    await waitFor(() => expect(result.current).toBe(320))

    act(() => {
      observerCallback?.(
        [{ contentRect: { width: 640 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      )
    })

    expect(result.current).toBe(640)
  })

  it('ref 为空时返回 0 且不抛错', () => {
    const { result } = renderHook(() => useElementWidth({ current: null }))
    expect(result.current).toBe(0)
  })

  it('元素晚于 hook 挂载出现时重新测量', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const ref: { current: HTMLElement | null } = { current: null }
    const { result, rerender } = renderHook(() => useElementWidth(ref))
    expect(result.current).toBe(0)

    const element = document.createElement('div')
    Object.defineProperty(element, 'clientWidth', { value: 480, configurable: true })
    ref.current = element
    rerender()

    await waitFor(() => expect(result.current).toBe(480))
  })
})

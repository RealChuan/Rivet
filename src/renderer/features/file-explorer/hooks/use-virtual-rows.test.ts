import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVariableVirtualRows, useVirtualRows } from './use-virtual-rows.js'

interface CapturedOptions {
  count?: number
  estimateSize?: (index: number) => number
  getScrollElement?: () => HTMLElement | null
  overscan?: number
}

const virtualItems = [{ end: 32, index: 0, key: 0, lane: 0, size: 32, start: 0 }]

const captured = vi.hoisted(() => ({ options: [] as CapturedOptions[] }))

vi.mock('@tanstack/react-virtual', () => ({
  Virtualizer: class {
    constructor(options: CapturedOptions) {
      captured.options.push(options)
    }

    setOptions(options: CapturedOptions) {
      captured.options.push(options)
    }

    _didMount() {
      return () => undefined
    }

    _willUpdate() {
      return () => undefined
    }

    getVirtualItems() {
      return virtualItems
    }

    getTotalSize() {
      return 64
    }
  },
  elementScroll: () => undefined,
  observeElementOffset: () => undefined,
  observeElementRect: () => undefined,
}))

describe('useVirtualRows', () => {
  it('把行数、行高与 overscan 传给虚拟化器', () => {
    const scrollRef = { current: document.createElement('div') }

    const { result } = renderHook(() => useVirtualRows({ rowCount: 12, rowHeight: 32, scrollRef }))

    expect(result.current).toEqual(virtualItems)

    const options = captured.options[captured.options.length - 1]
    expect(options).toMatchObject({ count: 12, overscan: 6 })
    expect(options?.estimateSize?.(0)).toBe(32)
    expect(options?.getScrollElement?.()).toBe(scrollRef.current)
  })
})

describe('useVariableVirtualRows', () => {
  it('按 index 估算行高并返回总高度', () => {
    const scrollRef = { current: document.createElement('div') }
    const estimateSize = (index: number) => (index === 0 ? 40 : 60)

    const { result } = renderHook(() =>
      useVariableVirtualRows({ estimateSize, overscan: 2, rowCount: 3, scrollRef }),
    )

    expect(result.current).toEqual({ totalSize: 64, virtualItems })

    const options = captured.options[captured.options.length - 1]
    expect(options).toMatchObject({ count: 3, overscan: 2 })
    expect(options?.estimateSize?.(1)).toBe(60)
    expect(options?.getScrollElement?.()).toBe(scrollRef.current)
  })
})

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useVariableVirtualRows, useVirtualRows } from './use-virtual-rows.js'

const estimateSize = (index: number) => (index === 0 ? 40 : 60)

describe('useVariableVirtualRows', () => {
  it('按估算高度累计总高度，并在行数变化后重新估算', () => {
    const scrollRef = { current: document.createElement('div') }

    const { result, rerender } = renderHook(
      ({ rowCount }: { rowCount: number }) =>
        useVariableVirtualRows({ estimateSize, rowCount, scrollRef }),
      { initialProps: { rowCount: 3 } },
    )

    expect(result.current.totalSize).toBe(160)

    rerender({ rowCount: 5 })

    expect(result.current.totalSize).toBe(280)
  })
})

describe('useVirtualRows', () => {
  it('尚未量出视口尺寸时不渲染任何行', () => {
    const scrollRef = { current: document.createElement('div') }

    const { result } = renderHook(() => useVirtualRows({ rowCount: 12, rowHeight: 32, scrollRef }))

    expect(result.current).toEqual([])
  })
})

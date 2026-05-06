import type { Dispatch, RefObject } from 'react'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualItem,
  type VirtualizerOptions,
} from '@tanstack/react-virtual'
import { useLayoutEffect, useReducer, useState } from 'react'
import { flushSync } from 'react-dom'
import { FILE_VIEW_OVERSCAN } from '../virtualization/layout.js'

interface UseVirtualRowsOptions {
  rowCount: number
  rowHeight: number
  scrollRef: RefObject<HTMLElement | null>
  overscan?: number
}

interface UseVariableVirtualRowsOptions {
  rowCount: number
  estimateSize: (index: number) => number
  scrollRef: RefObject<HTMLElement | null>
  overscan?: number
}

interface RowVirtualizerOptions {
  count: number
  estimateSize: (index: number) => number
  getScrollElement: () => HTMLElement | null
  overscan: number
}

type RowVirtualizer = Virtualizer<HTMLElement, Element>

/** 同步通知走 `flushSync`，滚动时行必须在同一次绘制里换掉，否则会闪空白。 */
const createOptions = (
  options: RowVirtualizerOptions,
  rerender: Dispatch<number>,
): VirtualizerOptions<HTMLElement, Element> => ({
  ...options,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  onChange: (_instance, sync) => {
    if (sync) {
      flushSync(() => {
        rerender(0)
      })
      return
    }
    rerender(0)
  },
})

/**
 * TanStack Virtual 的 `useVirtualizer()` 返回的函数无法被安全 memo，React Compiler
 * 只能跳过整个 hook（`react-hooks/incompatible-library`）。这里直接持有所在的
 * `Virtualizer` 类，自己接订阅与重渲染，交给 React 渲染的只有纯数据。
 */
function useRowVirtualizer(options: RowVirtualizerOptions): RowVirtualizer {
  const [, rerender] = useReducer((tick: number) => tick + 1, 0)

  const [virtualizer] = useState(
    () => new Virtualizer<HTMLElement, Element>(createOptions(options, rerender)),
  )

  virtualizer.setOptions(createOptions(options, rerender))

  useLayoutEffect(() => virtualizer._didMount(), [virtualizer])

  useLayoutEffect(() => virtualizer._willUpdate())

  return virtualizer
}

/** 可变行高虚拟化：传输列表使用，按 index 估算高度。 */
export function useVariableVirtualRows({
  rowCount,
  estimateSize,
  scrollRef,
  overscan,
}: UseVariableVirtualRowsOptions): { virtualItems: VirtualItem[]; totalSize: number } {
  const virtualizer = useRowVirtualizer({
    count: rowCount,
    estimateSize,
    getScrollElement: () => scrollRef.current,
    overscan: overscan ?? FILE_VIEW_OVERSCAN,
  })

  return {
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  }
}

/** 行级虚拟化：列表与宫格共用，列表一行一项、宫格一行 N 项。 */
export function useVirtualRows({
  rowCount,
  rowHeight,
  scrollRef,
  overscan,
}: UseVirtualRowsOptions): VirtualItem[] {
  const virtualizer = useRowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollRef.current,
    overscan: overscan ?? FILE_VIEW_OVERSCAN,
  })

  return virtualizer.getVirtualItems()
}

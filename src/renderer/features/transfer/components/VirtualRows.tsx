import type React from 'react'
import { useLayoutEffect, useRef, type ReactElement } from 'react'
import { useVariableVirtualRows } from '../../file-explorer/hooks/use-virtual-rows.js'

interface VirtualRowsProps<T> {
  items: T[]
  estimateSize: (index: number) => number
  overscan?: number
  className?: string
  /** 行高变化时递增，触发重新测量。 */
  revision?: number
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
}

export function VirtualRows<T>({
  items,
  estimateSize,
  overscan,
  className,
  revision,
  renderRow,
}: VirtualRowsProps<T>): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { virtualItems, totalSize, measure } = useVariableVirtualRows({
    rowCount: items.length,
    estimateSize,
    scrollRef,
    ...(overscan !== undefined ? { overscan } : {}),
  })

  const firstRun = useRef(true)
  useLayoutEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    measure()
  }, [measure, revision])

  return (
    <div ref={scrollRef} className={`h-full overflow-auto ${className ?? ''}`}>
      <div style={{ height: totalSize, position: 'relative', width: '100%' }}>
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index]
          if (!item) return null
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderRow(item, virtualRow.index, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VirtualRows

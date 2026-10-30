import type React from 'react'
import { useRef, type ReactElement } from 'react'
import { useVariableVirtualRows } from '../../file-explorer/hooks/use-virtual-rows.js'

interface VirtualRowsProps<T> {
  items: T[]
  estimateSize: (index: number) => number
  overscan?: number
  className?: string
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
}

export function VirtualRows<T>({
  items,
  estimateSize,
  overscan,
  className,
  renderRow,
}: VirtualRowsProps<T>): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { virtualItems, totalSize } = useVariableVirtualRows({
    rowCount: items.length,
    estimateSize,
    scrollRef,
    ...(overscan !== undefined ? { overscan } : {}),
  })

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

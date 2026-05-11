import React from 'react'

interface VirtualListProps<T> {
  items: T[] | undefined | null
  itemHeight: number
  width: string | number
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
}

export const VirtualList = <T,>({
  items: rawItems,
  itemHeight,
  width,
  renderItem,
}: VirtualListProps<T>) => {
  const items = rawItems ?? []

  return (
    <div className="relative" style={{ width }}>
      {items.map((item, index) => (
        <div key={index} className="overflow-hidden" style={{ height: itemHeight }}>
          {renderItem(item, index, {})}
        </div>
      ))}
    </div>
  )
}

export default VirtualList

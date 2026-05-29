import React, { type ReactElement } from 'react'
import { AutoSizer, type SizeProps } from 'react-virtualized-auto-sizer'
import { List, type ListImperativeAPI, type RowComponentProps } from 'react-window'

interface VirtualListProps<T> {
  items: T[] | undefined | null
  itemHeight: number
  width: string | number
  renderItem: (
    item: T,
    index: number,
    style: React.CSSProperties,
    containerWidth?: number
  ) => React.ReactNode
  listRef?: React.Ref<ListImperativeAPI>
  overscanCount?: number
  overflowStyle?: React.CSSProperties
}

interface RowProps<T> {
  items: T[]
  renderItem: VirtualListProps<T>['renderItem']
  containerWidth: number
}

function Row<T>({
  index,
  style,
  items,
  renderItem,
  containerWidth,
}: RowComponentProps<RowProps<T>>): ReactElement | null {
  const item = items[index]
  if (!item) return null
  const element = renderItem(item, index, style, containerWidth)
  if (!element) return null
  return (<>{element}</>) as ReactElement
}

const MemoRow = React.memo(Row, (prevProps, nextProps) => {
  return (
    prevProps.index === nextProps.index &&
    prevProps.items[prevProps.index] === nextProps.items[nextProps.index] &&
    prevProps.renderItem === nextProps.renderItem
  )
})

export function VirtualList<T>({
  items: rawItems,
  itemHeight,
  width,
  renderItem,
  listRef,
  overscanCount = 5,
  overflowStyle,
}: VirtualListProps<T>) {
  const items = rawItems ?? []

  const renderList = ({ height, width: containerWidth }: SizeProps) => {
    if (height === undefined || containerWidth === undefined) {
      return null
    }

    const rowProps = { items, renderItem, containerWidth }

    return (
      <List
        listRef={listRef ?? null}
        rowComponent={MemoRow as unknown as (props: unknown) => ReactElement | null}
        rowCount={items.length}
        rowHeight={itemHeight}
        rowProps={rowProps}
        style={{
          width: typeof width === 'number' ? Math.max(width, containerWidth) : containerWidth,
          height,
          ...overflowStyle,
        }}
        overscanCount={overscanCount}
      />
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <AutoSizer renderProp={renderList} />
    </div>
  )
}

export default VirtualList

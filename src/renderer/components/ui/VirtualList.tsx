import React, { useMemo, type ReactElement } from 'react'
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window'
import { AutoSizer, type SizeProps } from 'react-virtualized-auto-sizer'

interface VirtualListProps<T> {
  items: T[] | undefined | null
  itemHeight: number
  width: string | number
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  listRef?: React.Ref<ListImperativeAPI>
  overscanCount?: number
}

interface RowProps<T> {
  items: T[]
  renderItem: VirtualListProps<T>['renderItem']
}

function Row<T>({
  index,
  style,
  items,
  renderItem,
}: RowComponentProps<RowProps<T>>): ReactElement | null {
  const item = items[index]
  if (!item) return null
  const element = renderItem(item, index, style)
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
}: VirtualListProps<T>) {
  const items = useMemo(() => rawItems ?? [], [rawItems])

  const rowProps = useMemo<object>(() => ({ items, renderItem }), [items, renderItem])

  const renderList = ({ height, width: containerWidth }: SizeProps) => {
    if (height === undefined || containerWidth === undefined) {
      return null
    }
    return (
      <List
        listRef={listRef ?? null}
        rowComponent={MemoRow as unknown as (props: unknown) => ReactElement | null}
        rowCount={items.length}
        rowHeight={itemHeight}
        rowProps={rowProps}
        style={{
          width: typeof width === 'number' ? width : containerWidth,
          height,
          overflowX: 'visible',
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

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtualList } from './VirtualList.js'

vi.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({
    renderProp,
  }: {
    renderProp: (size: { height: number; width: number }) => React.ReactNode
  }) => {
    return renderProp({ height: 400, width: 800 })
  },
}))

vi.mock('react-window', () => ({
  List: ({
    rowHeight,
    rowProps,
    style,
  }: {
    rowHeight: number
    rowProps: {
      items: unknown[]
      renderItem: (item: unknown, index: number, style: React.CSSProperties) => React.ReactNode
      containerWidth: number
    }
    style: React.CSSProperties
  }) => {
    const items = rowProps.items
    const renderItem = rowProps.renderItem
    return (
      <div data-testid="virtual-list" style={style}>
        {items.map((item, index) => {
          const rowStyle = {
            height: rowHeight,
            position: 'absolute' as const,
            top: index * rowHeight,
          }
          return renderItem(item, index, rowStyle)
        })}
      </div>
    )
  },
}))

describe('VirtualList', () => {
  const items = ['Item 1', 'Item 2', 'Item 3']
  const renderItem = (item: string, index: number, style: React.CSSProperties) => (
    <div key={index} style={style} data-testid={`item-${index}`}>
      {item}
    </div>
  )

  it('should render specified number of items', () => {
    render(<VirtualList items={items} itemHeight={40} width={800} renderItem={renderItem} />)
    expect(screen.getByTestId('item-0')).not.toBeNull()
    expect(screen.getByTestId('item-1')).not.toBeNull()
    expect(screen.getByTestId('item-2')).not.toBeNull()
  })

  it('should not crash with empty array', () => {
    render(<VirtualList items={[]} itemHeight={40} width={800} renderItem={renderItem} />)
    const list = screen.getByTestId('virtual-list')
    expect(list).not.toBeNull()
  })

  it('should not crash with null items', () => {
    render(<VirtualList items={null} itemHeight={40} width={800} renderItem={renderItem} />)
    const list = screen.getByTestId('virtual-list')
    expect(list).not.toBeNull()
  })

  it('should not crash with undefined items', () => {
    render(<VirtualList items={undefined} itemHeight={40} width={800} renderItem={renderItem} />)
    const list = screen.getByTestId('virtual-list')
    expect(list).not.toBeNull()
  })

  it('should call renderItem for each item', () => {
    const mockRenderItem = vi.fn((item: string, index: number, style: React.CSSProperties) => (
      <div key={index} style={style}>
        {item}
      </div>
    ))
    render(<VirtualList items={items} itemHeight={40} width={800} renderItem={mockRenderItem} />)
    expect(mockRenderItem).toHaveBeenCalledTimes(3)
  })

  it('should apply overflowStyle to the list', () => {
    render(
      <VirtualList
        items={items}
        itemHeight={40}
        width={800}
        renderItem={renderItem}
        overflowStyle={{ overflow: 'visible' }}
      />
    )
    const list = screen.getByTestId('virtual-list')
    expect(list.style.overflow).toBe('visible')
  })

  it('should render item content correctly', () => {
    render(<VirtualList items={items} itemHeight={40} width={800} renderItem={renderItem} />)
    expect(screen.getByText('Item 1')).not.toBeNull()
    expect(screen.getByText('Item 2')).not.toBeNull()
    expect(screen.getByText('Item 3')).not.toBeNull()
  })
})

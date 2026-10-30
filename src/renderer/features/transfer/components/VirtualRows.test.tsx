import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VirtualRows } from './VirtualRows.js'

vi.mock('../../file-explorer/hooks/use-virtual-rows.js', () => ({
  useVariableVirtualRows: () => ({
    virtualItems: [
      { index: 0, key: 0, start: 0, size: 50 },
      { index: 1, key: 1, start: 50, size: 50 },
    ],
    totalSize: 100,
  }),
}))

describe('VirtualRows', () => {
  it('renders only virtual items with absolute offsets', () => {
    const { container } = render(
      <VirtualRows
        items={['row-0', 'row-1', 'row-2']}
        estimateSize={() => 50}
        renderRow={(item) => <span>{item}</span>}
      />,
    )

    expect(screen.getByText('row-0')).not.toBeNull()
    expect(screen.getByText('row-1')).not.toBeNull()
    expect(screen.queryByText('row-2')).toBeNull()
    expect(container.innerHTML).toContain('translateY(50px)')
    expect(container.innerHTML).toContain('height: 100px')
  })
})

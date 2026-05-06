import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SORT_ORDER } from '@shared/constants/sort.js'
import { FileListHeader } from './FileListHeader.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | ((ns: unknown) => unknown)) => {
      if (typeof key === 'function') {
        const path: string[] = []
        const proxy = new Proxy(
          {},
          {
            get(_target, prop) {
              if (typeof prop === 'string') path.push(prop)
              return proxy
            },
          },
        )
        key(proxy)
        return path.join('.')
      }
      return key
    },
    i18n: { language: 'en-US' },
  }),
}))

const defaultColumnWidths = {
  name: 300,
  permissions: 100,
  owner: 100,
  size: 100,
  modifyTime: 150,
}

const defaultProps = {
  columnWidths: defaultColumnWidths,
  sortBy: 'name' as const,
  sortOrder: SORT_ORDER.ASC as typeof SORT_ORDER.ASC,
  onSort: vi.fn(),
  onResizeStart: vi.fn(),
  isSftp: true,
}

describe('FileListHeader', () => {
  it('should render column headers', () => {
    render(<FileListHeader {...defaultProps} />)
    expect(screen.getByText('fileExplorerList.name')).not.toBeNull()
    expect(screen.getByText('fileExplorerList.permissions')).not.toBeNull()
    expect(screen.getByText('fileExplorerList.owner')).not.toBeNull()
    expect(screen.getByText('fileExplorerList.size')).not.toBeNull()
    expect(screen.getByText('fileExplorerList.dateModified')).not.toBeNull()
  })

  it('should hide permissions and owner columns in non-SFTP mode', () => {
    render(<FileListHeader {...defaultProps} isSftp={false} />)
    expect(screen.queryByText('fileExplorerList.permissions')).toBeNull()
    expect(screen.queryByText('fileExplorerList.owner')).toBeNull()
  })

  it('should show sort indicator for current sort column', () => {
    render(<FileListHeader {...defaultProps} sortBy="name" sortOrder={SORT_ORDER.ASC} />)
    const header = document.querySelector('[data-file-list-header]')
    if (!header) throw new Error('Header not found')
    const buttons = header.querySelectorAll('button')
    const nameButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('fileExplorerList.name'),
    )
    if (!nameButton) throw new Error('Name button not found')
    const svg = nameButton.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('should not show sort indicator for non-sort column', () => {
    render(<FileListHeader {...defaultProps} sortBy="name" sortOrder={SORT_ORDER.ASC} />)
    const header = document.querySelector('[data-file-list-header]')
    if (!header) throw new Error('Header not found')
    const buttons = header.querySelectorAll('button')
    const sizeButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('fileExplorerList.size'),
    )
    if (!sizeButton) throw new Error('Size button not found')
    const svg = sizeButton.querySelector('svg')
    expect(svg).toBeNull()
  })

  it('should call onSort when clicking a column header', () => {
    const onSort = vi.fn()
    render(<FileListHeader {...defaultProps} onSort={onSort} />)
    const buttons = screen.getAllByRole('button')
    const nameButton = buttons.find((b) => b.textContent?.includes('fileExplorerList.name'))
    if (!nameButton) throw new Error('Name button not found')
    fireEvent.click(nameButton)
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('should call onSort with size column', () => {
    const onSort = vi.fn()
    render(<FileListHeader {...defaultProps} onSort={onSort} />)
    const buttons = screen.getAllByRole('button')
    const sizeButton = buttons.find((b) => b.textContent?.includes('fileExplorerList.size'))
    if (!sizeButton) throw new Error('Size button not found')
    fireEvent.click(sizeButton)
    expect(onSort).toHaveBeenCalledWith('size')
  })

  it('should call onSort with modifyTime column', () => {
    const onSort = vi.fn()
    render(<FileListHeader {...defaultProps} onSort={onSort} />)
    const buttons = screen.getAllByRole('button')
    const dateButton = buttons.find((b) => b.textContent?.includes('fileExplorerList.dateModified'))
    if (!dateButton) throw new Error('Date button not found')
    fireEvent.click(dateButton)
    expect(onSort).toHaveBeenCalledWith('modifyTime')
  })

  it('should apply rotate-180 class for desc sort order', () => {
    render(<FileListHeader {...defaultProps} sortBy="name" sortOrder={SORT_ORDER.DESC} />)
    const header = document.querySelector('[data-file-list-header]')
    if (!header) throw new Error('Header not found')
    const buttons = header.querySelectorAll('button')
    const nameButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('fileExplorerList.name'),
    )
    if (!nameButton) throw new Error('Name button not found')
    const svg = nameButton.querySelector('svg')
    if (!svg) throw new Error('SVG not found')
    expect(svg.getAttribute('class') ?? '').toContain('rotate-180')
  })
})

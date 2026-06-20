import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { FileExplorerItem } from './FileExplorerItem.js'

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
  initReactI18next: vi.fn(),
}))

const mockFile: FileInfo = {
  name: 'test-file.txt',
  type: 'file',
  size: 1024,
  modifyTime: 1700000000000,
  permissions: 'rw-r--r--',
  owner: 'user1',
  absolutePath: '/home/test-file.txt',
}

const mockDirectory: FileInfo = {
  name: 'test-dir',
  type: 'directory',
  size: 0,
  modifyTime: 1700000000000,
  permissions: 'rwxr-xr-x',
  owner: 'user2',
  absolutePath: '/home/test-dir',
}

const defaultColumnWidths = {
  name: 300,
  permissions: 100,
  owner: 100,
  size: 100,
  modifyTime: 150,
}

const defaultProps = {
  file: mockFile,
  columnWidths: defaultColumnWidths,
  isSelected: false,
  isPending: false,
  isHovered: false,
  onHover: vi.fn(),
  onClick: vi.fn(),
  onDoubleClick: vi.fn(),
  onContextMenu: vi.fn(),
}

describe('FileExplorerItem', () => {
  it('should render file name', () => {
    render(<FileExplorerItem {...defaultProps} />)
    expect(screen.getByText('test-file.txt')).not.toBeNull()
  })

  it('should render file size for files', () => {
    render(<FileExplorerItem {...defaultProps} />)
    expect(screen.getByTitle('1 KB')).not.toBeNull()
  })

  it('should render modify date', () => {
    render(<FileExplorerItem {...defaultProps} />)
    const dateElements = document.querySelectorAll('[data-file-item] > div')
    expect(dateElements.length).toBeGreaterThan(0)
  })

  it('should render directory with dash for size', () => {
    render(<FileExplorerItem {...defaultProps} file={mockDirectory} />)
    expect(screen.getByText('test-dir')).not.toBeNull()
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FileExplorerItem {...defaultProps} onClick={onClick} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    fireEvent.click(item)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should call onDoubleClick when double-clicked', () => {
    const onDoubleClick = vi.fn()
    render(<FileExplorerItem {...defaultProps} onDoubleClick={onDoubleClick} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    fireEvent.doubleClick(item)
    expect(onDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('should call onContextMenu when right-clicked', () => {
    const onContextMenu = vi.fn()
    render(<FileExplorerItem {...defaultProps} onContextMenu={onContextMenu} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    fireEvent.contextMenu(item)
    expect(onContextMenu).toHaveBeenCalledTimes(1)
  })

  it('should apply selected state styling', () => {
    render(<FileExplorerItem {...defaultProps} isSelected={true} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    expect(item.className).toContain('bg-selected')
  })

  it('should apply hovered state styling', () => {
    render(<FileExplorerItem {...defaultProps} isHovered={true} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    expect(item.className).toContain('bg-hover')
  })

  it('should apply pending state styling', () => {
    render(<FileExplorerItem {...defaultProps} isPending={true} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    expect(item.className).toContain('bg-selected')
  })

  it('should call onHover with file name on mouse enter', () => {
    const onHover = vi.fn()
    render(<FileExplorerItem {...defaultProps} onHover={onHover} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    fireEvent.mouseEnter(item)
    expect(onHover).toHaveBeenCalledWith('test-file.txt')
  })

  it('should call onHover with null on mouse leave', () => {
    const onHover = vi.fn()
    render(<FileExplorerItem {...defaultProps} onHover={onHover} />)
    const item = document.querySelector('[data-file-item]')
    if (!item) throw new Error('File item not found')
    fireEvent.mouseLeave(item)
    expect(onHover).toHaveBeenCalledWith(null)
  })

  it('should hide permissions and owner columns in non-SFTP mode', () => {
    render(<FileExplorerItem {...defaultProps} isSftp={false} />)
    expect(screen.queryByTitle('rw-r--r--')).toBeNull()
  })
})

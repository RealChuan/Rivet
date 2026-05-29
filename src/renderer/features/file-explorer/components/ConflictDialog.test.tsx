import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { ConflictDialog } from './ConflictDialog.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}))

vi.mock('@renderer/utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), catch: vi.fn() },
}))

const sourceFile: FileInfo = {
  name: 'source.txt',
  type: 'file',
  size: 100,
  modifyTime: 1000,
  permissions: 'rw-r--r--',
  owner: 'user1',
  absolutePath: '/source/source.txt',
}

const targetFile: FileInfo = {
  name: 'target.txt',
  type: 'file',
  size: 200,
  modifyTime: 2000,
  permissions: 'rw-r--r--',
  owner: 'user2',
  absolutePath: '/target/target.txt',
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  conflicts: [
    {
      sourceFile,
      targetFile,
      targetExists: true,
    },
  ],
}

describe('ConflictDialog', () => {
  it('should not render when open is false', () => {
    render(<ConflictDialog {...defaultProps} open={false} />)
    expect(screen.queryByText('file.conflict.title')).toBeNull()
  })

  it('should show source file info', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText('source.txt')).not.toBeNull()
  })

  it('should show target file info', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText('target.txt')).not.toBeNull()
  })

  it('should show source path', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText(/\/source\/source.txt/)).not.toBeNull()
  })

  it('should show target path', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText(/\/target\/target.txt/)).not.toBeNull()
  })

  it('should call onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<ConflictDialog {...defaultProps} onClose={onClose} />)
    const cancelButton = screen.getByText('action.cancel')
    fireEvent.click(cancelButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<ConflictDialog {...defaultProps} onConfirm={onConfirm} />)
    const confirmButton = screen.getByText('action.confirm')
    fireEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should render skip radio button', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText('file.conflict.skip')).not.toBeNull()
  })

  it('should render keep both radio button', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText('file.conflict.keepBoth')).not.toBeNull()
  })

  it('should render overwrite radio button for copy operation', () => {
    render(<ConflictDialog {...defaultProps} operation="copy" />)
    expect(screen.getByText('file.conflict.overwrite')).not.toBeNull()
  })

  it('should not render overwrite radio button for move operation', () => {
    render(<ConflictDialog {...defaultProps} operation="move" />)
    expect(screen.queryByText('file.conflict.overwrite')).toBeNull()
  })

  it('should render apply to all checkbox', () => {
    render(<ConflictDialog {...defaultProps} />)
    expect(screen.getByText('file.conflict.applyToAll')).not.toBeNull()
  })

  it('should show global action panel when apply to all is checked', () => {
    render(<ConflictDialog {...defaultProps} />)
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    if (!checkbox) throw new Error('Checkbox not found')
    fireEvent.click(checkbox)
    expect(screen.getByText(/file\.conflict\.globalAction/)).not.toBeNull()
  })

  it('should handle conflict without target file', () => {
    const conflicts = [
      {
        sourceFile,
        targetFile: null,
        targetExists: false,
      },
    ]
    render(<ConflictDialog {...defaultProps} conflicts={conflicts} />)
    expect(screen.getAllByText('source.txt').length).toBeGreaterThan(0)
  })
})

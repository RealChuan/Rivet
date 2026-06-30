import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmationDialog } from './ConfirmationDialog.js'

vi.mock('@renderer/utils/index.js', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    catch: vi.fn(),
  },
}))

import { logger } from '@renderer/utils/index.js'

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Confirm action',
}

describe('ConfirmationDialog', () => {
  it('renders title and action buttons when open', () => {
    render(<ConfirmationDialog {...baseProps} />)
    expect(screen.getByText('Confirm action')).not.toBeNull()
    expect(screen.getByText('common.action.confirm')).not.toBeNull()
    expect(screen.getByText('common.action.cancel')).not.toBeNull()
  })

  it('does not render content when open is false', () => {
    render(<ConfirmationDialog {...baseProps} open={false} />)
    expect(screen.queryByText('Confirm action')).toBeNull()
  })

  it('calls onConfirm and onClose when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<ConfirmationDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />)
    fireEvent.click(screen.getByText('common.action.confirm'))
    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(logger.catch).not.toHaveBeenCalled()
  })

  it('calls onCancel and onClose when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const onClose = vi.fn()
    render(<ConfirmationDialog {...baseProps} onCancel={onCancel} onClose={onClose} />)
    fireEvent.click(screen.getByText('common.action.cancel'))
    await vi.waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still calls onClose and reports error when onConfirm throws synchronously', async () => {
    const onConfirm = vi.fn(() => {
      throw new Error('confirm failed')
    })
    const onClose = vi.fn()
    render(<ConfirmationDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />)
    fireEvent.click(screen.getByText('common.action.confirm'))
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(logger.catch).toHaveBeenCalledTimes(1)
    expect(logger.catch).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: 'confirmation-dialog-confirm' }),
    )
  })

  it('still calls onClose and reports error when onConfirm rejects asynchronously', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('async confirm failed'))
    const onClose = vi.fn()
    render(<ConfirmationDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />)
    fireEvent.click(screen.getByText('common.action.confirm'))
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(logger.catch).toHaveBeenCalledTimes(1)
    expect(logger.catch).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: 'confirmation-dialog-confirm' }),
    )
  })
})

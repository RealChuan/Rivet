import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSFER_CONFIG, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { useTransferStore } from '../stores/transfer.js'
import { ConcurrencyFields } from './ConcurrencyFields.js'

const transferApiMock = vi.hoisted(() => ({
  setConcurrency: vi.fn(() => Promise.resolve()),
  getConcurrency: vi.fn(() => Promise.resolve(5)),
}))

vi.mock('../../../api/transfer.js', () => ({ transferApi: transferApiMock }))

// Select 是 Radix 原语，jsdom 里开合不稳定；这里只验证「控件 → store → IPC」这条线。
vi.mock('../../../components/ui/Select.js', () => ({
  default: (props: { testId?: string; value: string; onChange: (value: string) => void }) => (
    <button
      type="button"
      {...(props.testId ? { 'data-testid': props.testId } : {})}
      data-value={props.value}
      onClick={() => props.onChange('8')}
    />
  ),
}))

describe('ConcurrencyFields', () => {
  beforeEach(() => {
    useTransferStore.setState({
      maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
      maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
    })
  })

  it('两个方向都从 store 读当前值', () => {
    render(<ConcurrencyFields />)

    expect(screen.getByTestId('upload-concurrency').getAttribute('data-value')).toBe('5')
    expect(screen.getByTestId('download-concurrency').getAttribute('data-value')).toBe('5')
  })

  it('改上传并发写回 store 并调用主进程', async () => {
    render(<ConcurrencyFields />)

    await userEvent.click(screen.getByTestId('upload-concurrency'))

    expect(useTransferStore.getState().maxUploadConcurrency).toBe(8)
    expect(transferApiMock.setConcurrency).toHaveBeenCalledWith(8, TRANSFER_DIRECTION.UPLOAD)
  })

  it('改下载并发写回 store 并调用主进程', async () => {
    render(<ConcurrencyFields />)

    await userEvent.click(screen.getByTestId('download-concurrency'))

    expect(useTransferStore.getState().maxDownloadConcurrency).toBe(8)
    expect(transferApiMock.setConcurrency).toHaveBeenCalledWith(8, TRANSFER_DIRECTION.DOWNLOAD)
  })
})

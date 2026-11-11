import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSFER_CONFIG, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { useTransferStore } from '../../transfer/stores/transfer.js'
import { TransferSection } from './TransferSection.js'

const transferApiMock = vi.hoisted(() => ({
  setConcurrency: vi.fn(() => Promise.resolve()),
  setSpeedLimit: vi.fn(() => Promise.resolve()),
  getConcurrency: vi.fn(() => Promise.resolve(5)),
  getSpeedLimit: vi.fn(() => Promise.resolve(0)),
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

describe('TransferSection', () => {
  beforeEach(() => {
    transferApiMock.setConcurrency.mockClear()
    transferApiMock.setSpeedLimit.mockClear()
    useTransferStore.setState({
      maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
      maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
      maxUploadBytesPerSecond: 0,
      maxDownloadBytesPerSecond: 2 * 1024 * 1024,
    })
  })

  it('并发与限速都从 store 读当前值，并按方向分列', () => {
    render(<TransferSection />)

    expect(screen.getByTestId('upload-concurrency').getAttribute('data-value')).toBe('5')
    expect(screen.getByTestId('download-concurrency').getAttribute('data-value')).toBe('5')
    expect(screen.getByTestId('upload-speed-limit')).toHaveProperty('value', '0')
    expect(screen.getByTestId('download-speed-limit')).toHaveProperty('value', '2048')
  })

  it('改上传并发写回 store 并调用主进程', async () => {
    render(<TransferSection />)

    await userEvent.click(screen.getByTestId('upload-concurrency'))

    expect(useTransferStore.getState().maxUploadConcurrency).toBe(8)
    expect(transferApiMock.setConcurrency).toHaveBeenCalledWith(8, TRANSFER_DIRECTION.UPLOAD)
  })

  it('改下载并发写回 store 并调用主进程', async () => {
    render(<TransferSection />)

    await userEvent.click(screen.getByTestId('download-concurrency'))

    expect(useTransferStore.getState().maxDownloadConcurrency).toBe(8)
    expect(transferApiMock.setConcurrency).toHaveBeenCalledWith(8, TRANSFER_DIRECTION.DOWNLOAD)
  })

  it('限速失焦才提交，避免逐字符把传输压到极低速率', async () => {
    render(<TransferSection />)
    const input = screen.getByTestId('upload-speed-limit')

    await userEvent.clear(input)
    await userEvent.type(input, '512')

    expect(transferApiMock.setSpeedLimit).not.toHaveBeenCalled()

    await userEvent.tab()

    expect(useTransferStore.getState().maxUploadBytesPerSecond).toBe(512 * 1024)
    expect(transferApiMock.setSpeedLimit).toHaveBeenCalledWith(
      512 * 1024,
      TRANSFER_DIRECTION.UPLOAD,
    )
  })

  it('清空限速输入等价于不限速', async () => {
    render(<TransferSection />)
    const input = screen.getByTestId('download-speed-limit')

    await userEvent.clear(input)
    await userEvent.tab()

    expect(useTransferStore.getState().maxDownloadBytesPerSecond).toBe(0)
    expect(transferApiMock.setSpeedLimit).toHaveBeenCalledWith(0, TRANSFER_DIRECTION.DOWNLOAD)
  })
})

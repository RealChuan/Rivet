import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog.js'

const systemApiMock = vi.hoisted(() => ({
  getLogDir: vi.fn(() => Promise.resolve('/tmp/rivet/logs')),
  getLogCacheSize: vi.fn(() => Promise.resolve(2048)),
  clearLogCache: vi.fn(() => Promise.resolve(1024)),
  openLogDir: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../api/system.js', () => ({ systemApi: systemApiMock }))

vi.mock('../../../api/transfer.js', () => ({
  transferApi: {
    setConcurrency: vi.fn(() => Promise.resolve()),
    getConcurrency: vi.fn(() => Promise.resolve(5)),
  },
}))

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('展示标题与四个分区入口', () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    expect(screen.getByText('settings.title')).not.toBeNull()
    expect(screen.getByText('settings.general')).not.toBeNull()
    expect(screen.getByText('settings.transfer')).not.toBeNull()
    expect(screen.getByText('settings.files')).not.toBeNull()
    expect(screen.getByText('settings.maintenance')).not.toBeNull()
  })

  it('默认落在通用分区', () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    expect(screen.getByTestId('close-behavior')).not.toBeNull()
    expect(screen.queryByTestId('upload-concurrency')).toBeNull()
  })

  it('切到传输分区展示并发与限速设置', async () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    await userEvent.click(screen.getByText('settings.transfer'))

    expect(screen.getByTestId('upload-concurrency')).not.toBeNull()
    expect(screen.getByTestId('download-concurrency')).not.toBeNull()
    expect(screen.getByTestId('upload-speed-limit')).not.toBeNull()
    expect(screen.getByTestId('download-speed-limit')).not.toBeNull()
    expect(screen.getByText('settings.transferNote')).not.toBeNull()
  })

  it('切到文件分区展示隐藏文件开关', async () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    await userEvent.click(screen.getByText('settings.files'))

    expect(screen.getByText('settings.hiddenFiles.label')).not.toBeNull()
    expect(screen.queryByTestId('upload-concurrency')).toBeNull()
  })

  it('切到维护分区展示日志位置与缓存大小', async () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    await userEvent.click(screen.getByText('settings.maintenance'))

    expect(screen.getByText('/tmp/rivet/logs')).not.toBeNull()
    expect(await screen.findByText('2 KB')).not.toBeNull()
  })

  it('清除缓存后刷新大小', async () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    await userEvent.click(screen.getByText('settings.maintenance'))
    await screen.findByText('2 KB')

    await userEvent.click(screen.getByTestId('settings-clear-cache'))

    expect(systemApiMock.clearLogCache).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(systemApiMock.getLogCacheSize).toHaveBeenCalledTimes(2))
  })

  it('打开所在位置调用主进程', async () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    await userEvent.click(screen.getByText('settings.maintenance'))
    await userEvent.click(screen.getByTestId('settings-open-log-dir'))

    expect(systemApiMock.openLogDir).toHaveBeenCalledTimes(1)
  })

  it('关闭按钮触发 onClose', async () => {
    const onClose = vi.fn()
    render(<SettingsDialog open onClose={onClose} />)

    await userEvent.click(screen.getByText('common.action.close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('窗口右下角带拉伸把手', () => {
    render(<SettingsDialog open onClose={vi.fn()} />)

    expect(screen.getByTestId('dialog-resize-handle')).not.toBeNull()
  })

  it('关闭状态下不渲染内容', () => {
    render(<SettingsDialog open={false} onClose={vi.fn()} />)

    expect(screen.queryByText('settings.title')).toBeNull()
  })
})

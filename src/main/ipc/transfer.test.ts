/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'

vi.mock('../services/transfer/index.js', () => ({
  transferService: {
    addTasks: vi.fn().mockReturnValue({ added: [], duplicates: [] }),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    retry: vi.fn(),
    retryAll: vi.fn(),
    getTasks: vi.fn().mockReturnValue([]),
    setConcurrency: vi.fn(),
  },
}))

describe('transfer IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup transfer handlers', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER.ADD, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER.CANCEL, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.TRANSFER.CANCEL_ALL,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.TRANSFER.RETRY, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.TRANSFER.RETRY_ALL,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.TRANSFER.GET_TASKS,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.TRANSFER.SET_CONCURRENCY,
      expect.any(Function)
    )
  })

  it('should call transferService.addTasks on ADD', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const addCall = calls.find(c => c[0] === IPC_CHANNELS.TRANSFER.ADD)
    const handler = addCall?.[1] as (...args: unknown[]) => unknown

    const tasks = [{ id: '1' }]
    handler({}, tasks)

    const { transferService } = await import('../services/transfer/index.js')
    expect(transferService.addTasks).toHaveBeenCalledWith(tasks)
  })

  it('should call transferService.cancel on CANCEL', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const cancelCall = calls.find(c => c[0] === IPC_CHANNELS.TRANSFER.CANCEL)
    const handler = cancelCall?.[1] as (...args: unknown[]) => unknown

    handler({}, 'task-1')

    const { transferService } = await import('../services/transfer/index.js')
    expect(transferService.cancel).toHaveBeenCalledWith('task-1')
  })

  it('should call transferService.getTasks on GET_TASKS', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const getTasksCall = calls.find(c => c[0] === IPC_CHANNELS.TRANSFER.GET_TASKS)
    const handler = getTasksCall?.[1] as (...args: unknown[]) => unknown

    handler({}, 'session-1')

    const { transferService } = await import('../services/transfer/index.js')
    expect(transferService.getTasks).toHaveBeenCalledWith('session-1')
  })

  it('should call transferService.setConcurrency on SET_CONCURRENCY', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const setConcurrencyCall = calls.find(c => c[0] === IPC_CHANNELS.TRANSFER.SET_CONCURRENCY)
    const handler = setConcurrencyCall?.[1] as (...args: unknown[]) => unknown

    handler({}, 5)

    const { transferService } = await import('../services/transfer/index.js')
    expect(transferService.setConcurrency).toHaveBeenCalledWith(5)
  })
})

/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSFER_DIRECTION } from '@shared/constants/index.js'
import { transferContract } from '@shared/contract/transfer.contract.js'

vi.mock('../stores/index.js', () => ({
  getTransferSettings: vi.fn(() => ({ maxUploadConcurrency: 5, maxDownloadConcurrency: 5 })),
  setTransferSettings: vi.fn(() => ({ success: true, value: undefined, error: null })),
}))

vi.mock('../services/transfer/index.js', () => ({
  transferService: {
    addTasks: vi.fn().mockReturnValue({ added: [], duplicates: [] }),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    retry: vi.fn(),
    retryAll: vi.fn(),
    getTasks: vi.fn().mockReturnValue([]),
    getConcurrency: vi.fn().mockReturnValue(3),
    setConcurrency: vi.fn(),
    checkLocalFiles: vi.fn().mockReturnValue([]),
    getLastDir: vi.fn().mockReturnValue(null),
    setLastDir: vi.fn(),
  },
}))

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>

const handleMock = (ipcMain as unknown as { handle: { mock: { calls: Array<[string, Handler]> } } })
  .handle

function getHandler(channel: string): Handler {
  const call = handleMock.mock.calls.find(([name]) => name === channel)
  if (!call) throw new Error(`channel not registered: ${channel}`)
  return call[1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: (() => void) | undefined
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve: () => resolve?.() }
}

describe('transfer IPC handlers', () => {
  it('注册契约里的全部通道（含此前遗漏的 4 个）', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel).sort()).toEqual(
      Object.keys(transferContract).sort(),
    )
  })

  it('add 转发任务数组', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    const { transferService } = await import('../services/transfer/index.js')
    setupTransferIpcHandlers()

    const tasks = [{ id: '1' }]
    await getHandler('transfer.add')({}, tasks)

    expect(transferService.addTasks).toHaveBeenCalledWith(tasks)
  })

  it('cancel 转发 taskId', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    const { transferService } = await import('../services/transfer/index.js')
    setupTransferIpcHandlers()

    await getHandler('transfer.cancel')({}, 'task-1')

    expect(transferService.cancel).toHaveBeenCalledWith('task-1')
  })

  it('getTasks 转发 sessionId', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    const { transferService } = await import('../services/transfer/index.js')
    setupTransferIpcHandlers()

    await getHandler('transfer.getTasks')({}, 'session-1')

    expect(transferService.getTasks).toHaveBeenCalledWith('session-1')
  })

  it('setConcurrency 转发并发数与方向', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    const { transferService } = await import('../services/transfer/index.js')
    vi.mocked(transferService.getConcurrency).mockReturnValue(3)
    setupTransferIpcHandlers()

    await getHandler('transfer.setConcurrency')({}, 5, TRANSFER_DIRECTION.UPLOAD)

    expect(transferService.setConcurrency).toHaveBeenCalledWith(5, TRANSFER_DIRECTION.UPLOAD)
    const { setTransferSettings } = await import('../stores/index.js')
    expect(setTransferSettings).toHaveBeenCalledWith({
      maxUploadConcurrency: 3,
      maxDownloadConcurrency: 5,
    })
  })

  it('cancel 等待服务方法完成并返回 Result', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    const { transferService } = await import('../services/transfer/index.js')
    setupTransferIpcHandlers()
    const gate = deferred()
    vi.mocked(transferService.cancel).mockImplementation(() => gate.promise)

    let settled = false
    const pending = getHandler('transfer.cancel')({}, 'task-1').then((result) => {
      settled = true
      return result
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(false)

    gate.resolve()
    const result = await pending
    expect(result).toMatchObject({ success: true })
  })

  it('retry 等待服务方法完成并返回 Result', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    const { transferService } = await import('../services/transfer/index.js')
    setupTransferIpcHandlers()
    const gate = deferred()
    vi.mocked(transferService.retry).mockImplementation(() => gate.promise)

    let settled = false
    const pending = getHandler('transfer.retry')({}, 'task-1').then((result) => {
      settled = true
      return result
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(false)

    gate.resolve()
    const result = await pending
    expect(result).toMatchObject({ success: true })
  })

  it('max 不是数字时返回 INVALID_CONFIG', async () => {
    const { setupTransferIpcHandlers } = await import('./transfer.js')
    setupTransferIpcHandlers()

    const result = await getHandler('transfer.setConcurrency')({}, '5', TRANSFER_DIRECTION.UPLOAD)

    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_CONFIG' } })
  })
})

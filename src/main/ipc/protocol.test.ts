/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { protocolContract } from '@shared/contract/protocol.contract.js'

vi.mock('../protocol/protocol-service.js', () => ({
  protocolService: {
    connect: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    disconnect: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    list: vi.fn().mockResolvedValue({ success: true, value: [], error: undefined }),
    mkdir: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    rename: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    delete: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    copy: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    move: vi.fn().mockResolvedValue({ success: true, value: undefined, error: undefined }),
    cancel: vi.fn(),
    calculateFolderStats: vi
      .fn()
      .mockResolvedValue({ success: true, value: undefined, error: null }),
    cancelCalculateFolderStats: vi.fn(),
  },
}))

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>

const handleMock = (ipcMain as unknown as { handle: { mock: { calls: Array<[string, Handler]> } } })
  .handle

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('protocol IPC handlers', () => {
  it('注册契约里的全部通道（含此前遗漏的文件夹统计）', async () => {
    const { setupProtocolIpcHandlers } = await import('./protocol.js')
    setupProtocolIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel).sort()).toEqual(
      Object.keys(protocolContract).sort(),
    )
  })

  it('list 通道把参数原样转给协议服务', async () => {
    const { protocolService } = await import('../protocol/protocol-service.js')
    const { setupProtocolIpcHandlers } = await import('./protocol.js')
    setupProtocolIpcHandlers()

    const call = handleMock.mock.calls.find(([channel]) => channel === 'protocol.list')
    if (!call) throw new Error('protocol.list not registered')
    await call[1]({}, 's1', '/tmp')

    expect(protocolService.list).toHaveBeenCalledWith('s1', '/tmp', undefined)
  })

  it('参数类型错误时返回 INVALID_CONFIG', async () => {
    const { setupProtocolIpcHandlers } = await import('./protocol.js')
    setupProtocolIpcHandlers()

    const call = handleMock.mock.calls.find(([channel]) => channel === 'protocol.list')
    if (!call) throw new Error('protocol.list not registered')
    const result = await call[1]({}, 42, '/tmp')

    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_CONFIG' } })
  })
})

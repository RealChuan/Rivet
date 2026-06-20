/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'

vi.mock('../services/protocol/protocol-service.js', () => ({
  protocolService: {
    connect: vi.fn().mockResolvedValue('session-id'),
    disconnect: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([]),
    mkdir: vi.fn().mockResolvedValue(true),
    rename: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    copy: vi.fn().mockResolvedValue(true),
    move: vi.fn().mockResolvedValue(true),
    cancel: vi.fn(),
  },
}))

describe('protocol IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup protocol handlers', async () => {
    const { setupProtocolIpcHandlers } = await import('./protocol.js')
    setupProtocolIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.CONNECT, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.PROTOCOL.DISCONNECT,
      expect.any(Function),
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.LIST, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.MKDIR, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.RENAME, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.DELETE, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.COPY, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.MOVE, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.PROTOCOL.CANCEL, expect.any(Function))
  })
})

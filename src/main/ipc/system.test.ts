import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/index.js', () => ({
  getTempDir: vi.fn().mockReturnValue({ success: true, value: '/tmp', error: null }),
  getDownloadDir: vi.fn().mockReturnValue({ success: true, value: '/downloads', error: null }),
  supportsGlassEffect: vi.fn().mockReturnValue(true),
  getLogDir: vi.fn().mockReturnValue({ success: true, value: '/logs', error: null }),
  getLogCacheSize: vi.fn().mockReturnValue({ success: true, value: 0, error: null }),
  clearLogCache: vi.fn().mockReturnValue({ success: true, value: 0, error: null }),
  openLogDir: vi.fn().mockResolvedValue({ success: true, value: undefined, error: null }),
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

describe('system IPC handlers', () => {
  it('按契约注册全部通道', async () => {
    const { setupSystemIpcHandlers } = await import('./system.js')
    setupSystemIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual([
      'system.getTempDir',
      'system.getDownloadDir',
      'system.supportsGlass',
      'system.generateUuid',
      'system.getLogDir',
      'system.getLogCacheSize',
      'system.clearLogCache',
      'system.openLogDir',
    ])
  })
})

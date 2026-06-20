/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'

vi.mock('../utils/index.js', () => ({
  getTempDir: vi.fn().mockReturnValue('/tmp'),
  getDownloadDir: vi.fn().mockReturnValue('/downloads'),
  supportsGlassEffect: vi.fn().mockReturnValue(true),
}))

describe('system IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup system handlers', async () => {
    const { setupSystemIpcHandlers } = await import('./system.js')
    setupSystemIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.SYSTEM.GET_TEMP_DIR,
      expect.any(Function),
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.SYSTEM.GET_DOWNLOAD_DIR,
      expect.any(Function),
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.SYSTEM.SUPPORTS_GLASS,
      expect.any(Function),
    )
  })
})

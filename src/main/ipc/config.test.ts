/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { ipcMain } from 'electron'

vi.mock('../stores/index.js', () => ({
  getConfigurationValue: vi.fn(),
  setConfigurationValue: vi.fn(),
}))

describe('config IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup config handlers', async () => {
    const { setupConfigIpcHandlers } = await import('./config.js')
    setupConfigIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG.GET, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG.SET, expect.any(Function))
  })
})

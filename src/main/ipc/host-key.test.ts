/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { ipcMain } from 'electron'

vi.mock('../stores/known-hosts.js', () => ({
  saveHostKeyRecord: vi.fn().mockReturnValue(true),
  removeHostKeyRecord: vi.fn().mockReturnValue(true),
}))

describe('host-key IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup host-key handlers', async () => {
    const { setupHostKeyIpcHandlers } = await import('./host-key.js')
    setupHostKeyIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOST_KEY.SAVE, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.HOST_KEY.DELETE, expect.any(Function))
  })
})

/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'

vi.mock('../utils/index.js', () => ({
  showSaveDialog: vi.fn().mockResolvedValue({ filePath: '', canceled: false }),
  showOpenDialog: vi.fn().mockResolvedValue({ filePaths: [], canceled: false }),
}))

describe('dialog IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup dialog handlers', async () => {
    const { setupDialogIpcHandlers } = await import('./dialog.js')
    setupDialogIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DIALOG.SHOW_SAVE_DIALOG,
      expect.any(Function),
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.DIALOG.SHOW_OPEN_DIALOG,
      expect.any(Function),
    )
  })
})

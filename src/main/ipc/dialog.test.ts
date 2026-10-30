import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/index.js', () => ({
  showSaveDialog: vi.fn().mockResolvedValue({ filePath: '', canceled: false }),
  showOpenDialog: vi.fn().mockResolvedValue({ filePaths: [], canceled: false }),
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

describe('dialog IPC handlers', () => {
  it('按契约注册两个通道', async () => {
    const { setupDialogIpcHandlers } = await import('./dialog.js')
    setupDialogIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual([
      'dialog.showOpenDialog',
      'dialog.showSaveDialog',
    ])
  })
})

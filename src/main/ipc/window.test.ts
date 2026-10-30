import { ipcMain } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handleMock = (ipcMain as unknown as { handle: { mock: { calls: Array<[string, Handler]> } } })
  .handle
const onMock = (ipcMain as unknown as { on: { mock: { calls: Array<[string, Handler]> } } }).on

beforeEach(() => {
  vi.clearAllMocks()
})

describe('window IPC handlers', () => {
  it('registers the window contract and returns the sender maximized state', async () => {
    const { setupWindowIpcHandlers } = await import('./window.js')
    setupWindowIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual(['window.getState'])
    expect(onMock.mock.calls.map(([channel]) => channel)).toEqual([
      'window.minimize',
      'window.toggleMaximize',
      'window.close',
    ])

    const handler = handleMock.mock.calls[0]?.[1]
    if (!handler) throw new Error('window.getState not registered')
    await expect(handler({ sender: {} })).resolves.toEqual({
      success: true,
      value: { isMaximized: false },
      error: null,
    })
  })
})

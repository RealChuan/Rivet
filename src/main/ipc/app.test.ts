/* eslint-disable @typescript-eslint/no-unsafe-return -- mock 透传 any 参数 */

import { ipcMain } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfirmClose = vi.fn()
const mockApplyWindowTheme = vi.fn()

vi.mock('../app/close-guard.js', () => ({
  confirmClose: () => mockConfirmClose(),
}))

vi.mock('../app/window-theme.js', () => ({
  applyWindowTheme: (...args: unknown[]) => mockApplyWindowTheme(...args),
}))

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>

const handleMock = (ipcMain as unknown as { handle: { mock: { calls: Array<[string, Handler]> } } })
  .handle
const onMock = (ipcMain as unknown as { on: { mock: { calls: Array<[string, Handler]> } } }).on

describe('app IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers confirmClose and setTheme', async () => {
    const { setupAppIpcHandlers } = await import('./app.js')
    setupAppIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual(['app.confirmClose'])
    expect(onMock.mock.calls.map(([channel]) => channel)).toEqual(['app.setTheme'])

    const confirm = handleMock.mock.calls[0]?.[1]
    if (!confirm) throw new Error('app.confirmClose not registered')
    await confirm({ sender: {} })

    const theme = onMock.mock.calls[0]?.[1]
    if (!theme) throw new Error('app.setTheme not registered')
    await theme({ sender: {} }, 'dark')

    expect(mockConfirmClose).toHaveBeenCalled()
    expect(mockApplyWindowTheme).toHaveBeenCalledWith('dark')
  })
})

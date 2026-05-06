import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../stores/index.js', () => ({
  getConfigurationValue: vi.fn(),
  setConfigurationValue: vi.fn(),
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

describe('config IPC handlers', () => {
  it('按契约注册两个通道', async () => {
    const { setupConfigIpcHandlers } = await import('./config.js')
    setupConfigIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual(['config.get', 'config.set'])
  })

  it('get 透传 key 到配置层', async () => {
    const { getConfigurationValue } = await import('../stores/index.js')
    const { setupConfigIpcHandlers } = await import('./config.js')
    setupConfigIpcHandlers()

    const handler = handleMock.mock.calls[0]
    if (!handler) throw new Error('handler not registered')
    await handler[1]({}, 'uiSettings')

    expect(getConfigurationValue).toHaveBeenCalledWith('uiSettings')
  })
})

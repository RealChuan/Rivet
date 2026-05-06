import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./app.js', () => ({ setupAppIpcHandlers: vi.fn() }))
vi.mock('./protocol.js', () => ({ setupProtocolIpcHandlers: vi.fn() }))
vi.mock('./config.js', () => ({ setupConfigIpcHandlers: vi.fn() }))
vi.mock('./dialog.js', () => ({ setupDialogIpcHandlers: vi.fn() }))
vi.mock('./host-key.js', () => ({ setupHostKeyIpcHandlers: vi.fn() }))
vi.mock('./system.js', () => ({ setupSystemIpcHandlers: vi.fn() }))
vi.mock('./transfer.js', () => ({ setupTransferIpcHandlers: vi.fn() }))
vi.mock('./window.js', () => ({ setupWindowIpcHandlers: vi.fn() }))
vi.mock('../utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), catch: vi.fn() },
}))

describe('setupIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call all setup functions', { timeout: 15000 }, async () => {
    const { setupIpcHandlers } = await import('./index.js')
    const { setupAppIpcHandlers } = await import('./app.js')
    const { setupProtocolIpcHandlers } = await import('./protocol.js')
    const { setupConfigIpcHandlers } = await import('./config.js')
    const { setupDialogIpcHandlers } = await import('./dialog.js')
    const { setupHostKeyIpcHandlers } = await import('./host-key.js')
    const { setupSystemIpcHandlers } = await import('./system.js')
    const { setupWindowIpcHandlers } = await import('./window.js')
    setupIpcHandlers()

    expect(setupAppIpcHandlers).toHaveBeenCalledOnce()
    expect(setupProtocolIpcHandlers).toHaveBeenCalledOnce()
    expect(setupConfigIpcHandlers).toHaveBeenCalledOnce()
    expect(setupDialogIpcHandlers).toHaveBeenCalledOnce()
    expect(setupHostKeyIpcHandlers).toHaveBeenCalledOnce()
    expect(setupSystemIpcHandlers).toHaveBeenCalledOnce()
    expect(setupWindowIpcHandlers).toHaveBeenCalledOnce()
  })

  it('should log after registering all handlers', async () => {
    const { setupIpcHandlers } = await import('./index.js')
    const { logger } = await import('../utils/index.js')

    setupIpcHandlers()

    expect(logger.info).toHaveBeenCalledWith('All IPC handlers registered')
  })
})

import { ipcMain } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTrustHostKey = vi.fn(() => ({ success: true, value: undefined, error: null }))

vi.mock('../stores/known-hosts.js', () => ({
  trustHostKey: mockTrustHostKey,
}))

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>

const handleMock = (ipcMain as unknown as { handle: { mock: { calls: Array<[string, Handler]> } } })
  .handle

beforeEach(() => {
  vi.clearAllMocks()
})

describe('host-key IPC handlers', () => {
  it('registers hostKey.trust and forwards the record', async () => {
    const { setupHostKeyIpcHandlers } = await import('./host-key.js')
    setupHostKeyIpcHandlers()

    expect(handleMock.mock.calls.map(([channel]) => channel)).toEqual(['hostKey.trust'])

    const handler = handleMock.mock.calls[0]?.[1]
    if (!handler) throw new Error('hostKey.trust not registered')
    const record = { host: 'h', port: 22, algorithm: 'a', fingerprint: 'f' }
    await handler({}, record)

    expect(mockTrustHostKey).toHaveBeenCalledWith(record)
  })
})

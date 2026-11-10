import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig, ConnectRequest } from '@shared/types/index.js'
import { useSessionConnect } from './use-session-connect.js'

const mockHandleConnectWithHostKey = vi.fn()
const mockReplaceSession = vi.fn()
const mockGetConnectionById = vi.fn()
const mockStat = vi.fn()

const mockSessions: Array<{ sessionId: string }> = []
const mockLastPath: { value: string | undefined } = { value: undefined }

vi.mock('./host-key-connect.js', () => ({
  handleConnectWithHostKey: (...args: unknown[]): Promise<unknown> =>
    Promise.resolve(mockHandleConnectWithHostKey(...(args as [ConnectRequest]))),
}))

vi.mock('../stores/session.js', () => ({
  useSessionStore: {
    getState: () => ({
      sessions: mockSessions,
      replaceSession: mockReplaceSession,
    }),
  },
}))

vi.mock('../stores/connection.js', () => ({
  useConnectionStore: {
    getState: () => ({
      getConnectionById: (id: string): unknown => mockGetConnectionById(id),
    }),
  },
}))

vi.mock('../stores/last-paths.js', () => ({
  useLastPathsStore: {
    getState: () => ({ getPath: (): string | undefined => mockLastPath.value }),
  },
}))

vi.mock('../../../api/protocol.js', () => ({
  protocolApi: {
    stat: (sessionId: string, path: string): unknown => mockStat(sessionId, path),
  },
}))

vi.mock('@shared/constants/index.js', () => ({
  ROOT_PATH: '/',
  FILE_TYPE: { FILE: 'file', DIRECTORY: 'directory' },
}))

const mockConfig: ConnectionConfig = {
  id: 'conn-1',
  name: 'TestServer',
  protocol: 'sftp',
  host: 'localhost',
  port: 22,
  username: 'user',
}

describe('useSessionConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessions.length = 0
    mockHandleConnectWithHostKey.mockResolvedValue({
      success: true,
      sessionId: 'sess-1',
      retry: false,
    })
    mockGetConnectionById.mockReturnValue({ ...mockConfig })
    mockStat.mockReset()
    mockLastPath.value = undefined
  })

  describe('connectSession', () => {
    it('should add session to store and return true on successful connection', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession({ connection: mockConfig })

      expect(success).toBe(true)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith({ connection: mockConfig })
      expect(mockReplaceSession).toHaveBeenCalled()
    })

    it('should start at root when no path is remembered', async () => {
      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockStat).not.toHaveBeenCalled()
      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('should restore the remembered directory after verifying it with stat', async () => {
      mockLastPath.value = '/home/user/work'
      mockStat.mockResolvedValue({ type: 'directory' })

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockStat).toHaveBeenCalledWith('sess-1', '/home/user/work')
      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/home/user/work' }),
      )
    })

    it('should fall back to root when the remembered path is gone', async () => {
      mockLastPath.value = '/home/user/work'
      mockStat.mockRejectedValue(new Error('no such file'))

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('should fall back to root when the remembered path is a file', async () => {
      mockLastPath.value = '/home/user/file.txt'
      mockStat.mockResolvedValue({ type: 'file' })

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('should skip the stat probe when the remembered path is already root', async () => {
      mockLastPath.value = '/'

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockStat).not.toHaveBeenCalled()
      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('should return false on failed connection', async () => {
      mockHandleConnectWithHostKey.mockResolvedValue({
        success: false,
        sessionId: null,
        retry: false,
      })

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession({ connection: mockConfig })

      expect(success).toBe(false)
      expect(mockReplaceSession).not.toHaveBeenCalled()
    })

    it('should retry when first call returns retry=true then succeed', async () => {
      mockHandleConnectWithHostKey
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: true })
        .mockResolvedValueOnce({ success: true, sessionId: 'sess-1', retry: false })

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession({ connection: mockConfig })

      expect(success).toBe(true)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledTimes(2)
    })

    it('should return false after retry then failure', async () => {
      mockHandleConnectWithHostKey
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: true })
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: false })

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession({ connection: mockConfig })

      expect(success).toBe(false)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledTimes(2)
      expect(mockReplaceSession).not.toHaveBeenCalled()
    })
  })

  describe('reconnectSession', () => {
    it('should throw when connection not found', async () => {
      mockGetConnectionById.mockReturnValue(undefined)

      const { result } = renderHook(() => useSessionConnect())

      await expect(result.current.reconnectSession('unknown-id')).rejects.toThrow(
        'Connection not found',
      )
    })

    it('should call connectSession with the connection config on successful reconnect', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.reconnectSession('conn-1')

      expect(success).toBe(true)
      expect(mockGetConnectionById).toHaveBeenCalledWith('conn-1')
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith({ connection: mockConfig })
    })

    it('should pass the secret and saveSecret to connectSession', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.reconnectSession('conn-1', 'secret', true)

      expect(success).toBe(true)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith({
        connection: mockConfig,
        secret: 'secret',
        saveSecret: true,
      })
    })
  })
})

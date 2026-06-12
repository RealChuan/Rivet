import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import { useSessionConnect } from './use-session-connect.js'

const mockHandleConnectWithHostKey = vi.fn()
const mockSetState = vi.fn()
const mockRefreshCurrentDirectory = vi.fn()
const mockGetConnectionById = vi.fn()

const mockSessions: Array<{
  sessionId: string
  connectionId: string
  currentPath: string
  files: unknown[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
}> = []

vi.mock('./host-key-connect.js', () => ({
  handleConnectWithHostKey: (...args: unknown[]): Promise<unknown> =>
    mockHandleConnectWithHostKey(...(args as [ConnectionConfig])) as Promise<unknown>,
}))

vi.mock('../stores/session.js', () => ({
  useSessionStore: {
    setState: (updater: unknown): void => {
      mockSetState(updater)
    },
    getState: () => ({
      sessions: mockSessions,
      refreshCurrentDirectory: mockRefreshCurrentDirectory,
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

vi.mock('@shared/constants/index.js', () => ({
  ROOT_PATH: '/',
  HOST_KEY_DIALOG_TYPE: { FIRST_CONNECT: 'first-connect', CHANGED: 'changed' },
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
    mockSetState.mockImplementation(
      (
        updater: (state: { sessions: unknown[] }) => {
          sessions: unknown[]
          activeSessionId: string
        }
      ) => {
        const result = updater({ sessions: mockSessions })
        mockSessions.length = 0
        mockSessions.push(...(result.sessions as typeof mockSessions))
      }
    )
    mockRefreshCurrentDirectory.mockResolvedValue(undefined)
    mockHandleConnectWithHostKey.mockResolvedValue({
      success: true,
      sessionId: 'sess-1',
      retry: false,
    })
    mockGetConnectionById.mockReturnValue({ ...mockConfig })
  })

  describe('connectSession', () => {
    it('should add session to store and return true on successful connection', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession(mockConfig)

      expect(success).toBe(true)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith(mockConfig)
      expect(mockSetState).toHaveBeenCalled()
      expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('sess-1')
    })

    it('should return false on failed connection', async () => {
      mockHandleConnectWithHostKey.mockResolvedValue({
        success: false,
        sessionId: null,
        retry: false,
      })

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession(mockConfig)

      expect(success).toBe(false)
      expect(mockSetState).not.toHaveBeenCalled()
      expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
    })

    it('should retry when first call returns retry=true then succeed', async () => {
      mockHandleConnectWithHostKey
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: true })
        .mockResolvedValueOnce({ success: true, sessionId: 'sess-1', retry: false })

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession(mockConfig)

      expect(success).toBe(true)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledTimes(2)
      expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('sess-1')
    })

    it('should return false after retry then failure', async () => {
      mockHandleConnectWithHostKey
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: true })
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: false })

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.connectSession(mockConfig)

      expect(success).toBe(false)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledTimes(2)
      expect(mockSetState).not.toHaveBeenCalled()
      expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
    })
  })

  describe('reconnectSession', () => {
    it('should throw when connection not found', async () => {
      mockGetConnectionById.mockReturnValue(undefined)

      const { result } = renderHook(() => useSessionConnect())

      await expect(result.current.reconnectSession('unknown-id')).rejects.toThrow(
        'Connection not found'
      )
    })

    it('should call connectSession with the connection config on successful reconnect', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.reconnectSession('conn-1')

      expect(success).toBe(true)
      expect(mockGetConnectionById).toHaveBeenCalledWith('conn-1')
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith(mockConfig)
    })

    it('should merge passwordConfig into connection config', async () => {
      const passwordConfig = { password: 'secret', savePassword: true }

      const { result } = renderHook(() => useSessionConnect())

      const success = await result.current.reconnectSession('conn-1', passwordConfig)

      expect(success).toBe(true)
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith({
        ...mockConfig,
        ...passwordConfig,
      })
    })
  })
})

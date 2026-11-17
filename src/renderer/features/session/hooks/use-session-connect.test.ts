import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import { ApiError } from '../../../api/result.js'
import { useConnectRequestsStore } from '../stores/connect-requests.js'
import { useSessionConnect } from './use-session-connect.js'

const mockHandleConnectWithHostKey = vi.fn()
const mockReplaceSession = vi.fn()
const mockGetConnectionById = vi.fn()
const mockStat = vi.fn()
const mockDisconnect = vi.fn()

const mockSessions: Array<{ sessionId: string }> = []
const mockLastPath: { value: string | undefined } = { value: undefined }

vi.mock('./host-key-connect.js', () => ({
  handleConnectWithHostKey: (...args: unknown[]): Promise<unknown> =>
    Promise.resolve(mockHandleConnectWithHostKey(...args)),
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
    stat: (sessionId: string, path: string, signal?: AbortSignal): unknown =>
      mockStat(sessionId, path, signal),
    disconnect: (sessionId: string): unknown => mockDisconnect(sessionId),
  },
}))

vi.mock('@shared/constants/index.js', () => ({
  ROOT_PATH: '/',
  FILE_TYPE: { FILE: 'file', DIRECTORY: 'directory' },
  ERROR_CODE: { REQUEST_ABORTED: 'REQUEST_ABORTED' },
}))

const mockConfig: ConnectionConfig = {
  id: 'conn-1',
  name: 'TestServer',
  protocol: 'sftp',
  host: 'localhost',
  port: 22,
  username: 'user',
}

function signalOf(callIndex = 0): AbortSignal {
  const signal: unknown = mockHandleConnectWithHostKey.mock.calls[callIndex]?.[1]
  if (!(signal instanceof AbortSignal)) throw new Error('signal not passed to connect')
  return signal
}

describe('useSessionConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConnectRequestsStore.setState({ pending: {}, lastRequestedId: null })
    mockSessions.length = 0
    mockHandleConnectWithHostKey.mockResolvedValue({
      success: true,
      sessionId: 'sess-1',
      retry: false,
    })
    mockGetConnectionById.mockReturnValue({ ...mockConfig })
    mockStat.mockReset()
    mockDisconnect.mockResolvedValue(undefined)
    mockLastPath.value = undefined
  })

  describe('connectSession', () => {
    it('returns connected and writes the session on success', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const outcome = await result.current.connectSession({ connection: mockConfig })

      expect(outcome).toEqual({ status: 'connected' })
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith(
        { connection: mockConfig },
        expect.any(AbortSignal),
      )
      expect(mockReplaceSession).toHaveBeenCalled()
    })

    it('starts at root when no path is remembered', async () => {
      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockStat).not.toHaveBeenCalled()
      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('restores the remembered directory after verifying it with stat', async () => {
      mockLastPath.value = '/home/user/work'
      mockStat.mockResolvedValue({ type: 'directory' })

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockStat).toHaveBeenCalledWith('sess-1', '/home/user/work', expect.any(AbortSignal))
      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/home/user/work' }),
      )
    })

    it('falls back to root when the remembered path is gone', async () => {
      mockLastPath.value = '/home/user/work'
      mockStat.mockRejectedValue(new Error('no such file'))

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('falls back to root when the remembered path is a file', async () => {
      mockLastPath.value = '/home/user/file.txt'
      mockStat.mockResolvedValue({ type: 'file' })

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('skips the stat probe when the remembered path is already root', async () => {
      mockLastPath.value = '/'

      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(mockStat).not.toHaveBeenCalled()
      expect(mockReplaceSession).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ currentPath: '/' }),
      )
    })

    it('returns cancelled when the host key dialog is declined', async () => {
      mockHandleConnectWithHostKey.mockResolvedValue({
        success: false,
        sessionId: null,
        retry: false,
      })

      const { result } = renderHook(() => useSessionConnect())

      const outcome = await result.current.connectSession({ connection: mockConfig })

      expect(outcome).toEqual({ status: 'cancelled' })
      expect(mockReplaceSession).not.toHaveBeenCalled()
    })

    it('returns cancelled for REQUEST_ABORTED and failed for anything else', async () => {
      const aborted = new ApiError({ code: 'REQUEST_ABORTED', message: 'aborted' })
      mockHandleConnectWithHostKey.mockRejectedValueOnce(aborted)

      const { result } = renderHook(() => useSessionConnect())

      await expect(result.current.connectSession({ connection: mockConfig })).resolves.toEqual({
        status: 'cancelled',
      })

      const failure = new Error('boom')
      mockHandleConnectWithHostKey.mockRejectedValueOnce(failure)

      await expect(result.current.connectSession({ connection: mockConfig })).resolves.toEqual({
        status: 'failed',
        error: failure,
      })
    })

    it('disconnects the session when cancelled after connect succeeded', async () => {
      mockLastPath.value = '/home'
      mockStat.mockImplementation(() => {
        useConnectRequestsStore.getState().cancel('conn-1')
        return Promise.reject(new Error('aborted'))
      })

      const { result } = renderHook(() => useSessionConnect())

      const outcome = await result.current.connectSession({ connection: mockConfig })

      expect(outcome).toEqual({ status: 'cancelled' })
      expect(mockDisconnect).toHaveBeenCalledWith('sess-1')
      expect(mockReplaceSession).not.toHaveBeenCalled()
    })

    it('retries when first call returns retry=true then succeeds', async () => {
      mockHandleConnectWithHostKey
        .mockResolvedValueOnce({ success: false, sessionId: null, retry: true })
        .mockResolvedValueOnce({ success: true, sessionId: 'sess-1', retry: false })

      const { result } = renderHook(() => useSessionConnect())

      const outcome = await result.current.connectSession({ connection: mockConfig })

      expect(outcome).toEqual({ status: 'connected' })
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledTimes(2)
      // 重试沿用同一个 signal：取消一次就能作用于整串尝试。
      expect(signalOf(0)).toBe(signalOf(1))
    })

    it('reports busy instead of stacking a second attempt on the same connection', async () => {
      let resolveConnect: (value: unknown) => void = () => undefined
      mockHandleConnectWithHostKey.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConnect = resolve
          }),
      )

      const { result } = renderHook(() => useSessionConnect())

      const first = result.current.connectSession({ connection: mockConfig })
      const second = await result.current.connectSession({ connection: mockConfig })

      expect(second).toEqual({ status: 'busy' })
      resolveConnect({ success: true, sessionId: 'sess-1', retry: false })
      await expect(first).resolves.toEqual({ status: 'connected' })
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledTimes(1)
    })

    it('clears the pending flag when the attempt ends', async () => {
      const { result } = renderHook(() => useSessionConnect())

      await result.current.connectSession({ connection: mockConfig })

      expect(useConnectRequestsStore.getState().pending['conn-1']).toBeUndefined()
    })
  })

  describe('cancelConnect', () => {
    it('aborts only the requested connection', () => {
      const { result } = renderHook(() => useSessionConnect())
      const first = useConnectRequestsStore.getState().begin('conn-1')
      const second = useConnectRequestsStore.getState().begin('conn-2')
      if (!first || !second) throw new Error('begin should hand out signals')

      result.current.cancelConnect('conn-1')

      expect(first.aborted).toBe(true)
      expect(second.aborted).toBe(false)
    })
  })

  describe('reconnectSession', () => {
    it('throws when connection not found', async () => {
      mockGetConnectionById.mockReturnValue(undefined)

      const { result } = renderHook(() => useSessionConnect())

      await expect(result.current.reconnectSession('unknown-id')).rejects.toThrow(
        'Connection not found',
      )
    })

    it('connects with the stored config', async () => {
      const { result } = renderHook(() => useSessionConnect())

      const outcome = await result.current.reconnectSession('conn-1')

      expect(outcome).toEqual({ status: 'connected' })
      expect(mockGetConnectionById).toHaveBeenCalledWith('conn-1')
      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith(
        { connection: mockConfig },
        expect.any(AbortSignal),
      )
    })

    it('passes the secret and saveSecret through', async () => {
      const { result } = renderHook(() => useSessionConnect())

      await result.current.reconnectSession('conn-1', 'secret', true)

      expect(mockHandleConnectWithHostKey).toHaveBeenCalledWith(
        { connection: mockConfig, secret: 'secret', saveSecret: true },
        expect.any(AbortSignal),
      )
    })
  })
})

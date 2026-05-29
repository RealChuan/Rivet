import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileInfo, Session } from '@shared/types/index.js'
import { useSessionStore } from './session.js'

// ---------------------------------------------------------------------------
// Mock: window.electronAPI
// ---------------------------------------------------------------------------
const mockProtocolCancel = vi.fn()
const mockProtocolList = vi.fn()
const mockGenerateUuid = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    protocol: {
      cancel: mockProtocolCancel,
      list: mockProtocolList,
    },
    generateUuid: mockGenerateUuid,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeSession = (overrides: Partial<Session> = {}): Session => ({
  sessionId: 'sess-1',
  connectionId: 'conn-1',
  currentPath: '/home',
  files: [],
  isConnected: true,
  isLoading: false,
  error: null,
  ...overrides,
})

const makeFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  name: 'test.txt',
  type: 'file',
  size: 1024,
  modifyTime: 1700000000000,
  permissions: 'rw-r--r--',
  owner: 'user',
  absolutePath: '/home/test.txt',
  ...overrides,
})

const okResponse = <T>(value: T) => ({
  requestId: 'req-1',
  success: true as const,
  value,
  error: undefined,
})

const errResponse = (message: string) => ({
  requestId: 'req-1',
  success: false as const,
  value: undefined,
  error: { code: 'ERR', message, detail: undefined, stack: undefined },
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useSessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateUuid.mockReturnValue('uuid-1')
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      currentListRequestId: null,
    })
  })

  // =========================================================================
  // sanitizeFiles (tested indirectly through setFiles)
  // =========================================================================
  describe('sanitizeFiles (via setFiles)', () => {
    it('should filter out entries with missing name', () => {
      const input = [
        { name: '', type: 'file' as const, size: 10, modifyTime: 1, absolutePath: '/a' },
      ]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out entries with non-string name', () => {
      const input = [{ name: 123, type: 'file', size: 10, modifyTime: 1, absolutePath: '/a' }]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input as unknown as FileInfo[])
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out entries with invalid type', () => {
      const input = [{ name: 'a', type: 'link', size: 10, modifyTime: 1, absolutePath: '/a' }]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input as unknown as FileInfo[])
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out entries with negative size', () => {
      const input = [
        { name: 'a', type: 'file' as const, size: -1, modifyTime: 1, absolutePath: '/a' },
      ]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out entries with NaN size', () => {
      const input = [
        { name: 'a', type: 'file' as const, size: NaN, modifyTime: 1, absolutePath: '/a' },
      ]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out entries with non-finite modifyTime', () => {
      const input = [
        { name: 'a', type: 'file' as const, size: 0, modifyTime: Infinity, absolutePath: '/a' },
      ]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out entries with empty absolutePath', () => {
      const input = [{ name: 'a', type: 'file' as const, size: 0, modifyTime: 1, absolutePath: '' }]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should sanitize special characters in file names', () => {
      const input = [makeFileInfo({ name: 'file<>:|"\\/*?.txt' })]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      const file = session.files[0]
      if (!file) throw new Error('file not found')
      expect(file.name).toBe('file_________.txt')
    })

    it('should return empty array for null input', () => {
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', null as unknown as FileInfo[])
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should return empty array for undefined input', () => {
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', undefined as unknown as FileInfo[])
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should return empty array for non-array input', () => {
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', 'not-array' as unknown as FileInfo[])
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toEqual([])
    })

    it('should filter out null entries in array', () => {
      const input = [null, makeFileInfo(), undefined]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input as unknown as FileInfo[])
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files).toHaveLength(1)
    })

    it('should default permissions and owner to empty string when missing', () => {
      const input = [
        { name: 'a', type: 'file' as const, size: 0, modifyTime: 1, absolutePath: '/a' },
      ]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      const file = session.files[0]
      if (!file) throw new Error('file not found')
      expect(file.permissions).toBe('')
      expect(file.owner).toBe('')
    })

    it('should preserve valid permissions and owner', () => {
      const input = [makeFileInfo({ permissions: 'rwxr-xr-x', owner: 'admin' })]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      const file = session.files[0]
      if (!file) throw new Error('file not found')
      expect(file.permissions).toBe('rwxr-xr-x')
      expect(file.owner).toBe('admin')
    })

    it('should normalize type to file or directory', () => {
      const input = [
        makeFileInfo({ type: 'directory' }),
        makeFileInfo({ type: 'file', name: 'b.txt' }),
      ]
      useSessionStore.setState({ sessions: [makeSession()] })
      useSessionStore.getState().setFiles('sess-1', input)
      const session = useSessionStore.getState().getSessionById('sess-1')
      if (!session) throw new Error('session not found')
      expect(session.files[0]?.type).toBe('directory')
      expect(session.files[1]?.type).toBe('file')
    })
  })

  // =========================================================================
  // addSession
  // =========================================================================
  describe('addSession', () => {
    it('should add a session and set it as active', () => {
      const session = makeSession()
      useSessionStore.getState().addSession(session)
      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0]?.sessionId).toBe('sess-1')
      expect(state.activeSessionId).toBe('sess-1')
    })

    it('should add multiple sessions and last one becomes active', () => {
      const s1 = makeSession({ sessionId: 'sess-1' })
      const s2 = makeSession({ sessionId: 'sess-2' })
      useSessionStore.getState().addSession(s1)
      useSessionStore.getState().addSession(s2)
      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(2)
      expect(state.activeSessionId).toBe('sess-2')
    })
  })

  // =========================================================================
  // removeSession
  // =========================================================================
  describe('removeSession', () => {
    it('should remove a session by id', () => {
      const s1 = makeSession({ sessionId: 'sess-1' })
      const s2 = makeSession({ sessionId: 'sess-2' })
      useSessionStore.setState({ sessions: [s1, s2], activeSessionId: 'sess-1' })
      useSessionStore.getState().removeSession('sess-1')
      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0]?.sessionId).toBe('sess-2')
    })

    it('should clear activeSessionId when removing the active session', () => {
      const s1 = makeSession({ sessionId: 'sess-1' })
      useSessionStore.setState({ sessions: [s1], activeSessionId: 'sess-1' })
      useSessionStore.getState().removeSession('sess-1')
      expect(useSessionStore.getState().activeSessionId).toBeNull()
    })

    it('should keep activeSessionId when removing a non-active session', () => {
      const s1 = makeSession({ sessionId: 'sess-1' })
      const s2 = makeSession({ sessionId: 'sess-2' })
      useSessionStore.setState({ sessions: [s1, s2], activeSessionId: 'sess-2' })
      useSessionStore.getState().removeSession('sess-1')
      expect(useSessionStore.getState().activeSessionId).toBe('sess-2')
    })
  })

  // =========================================================================
  // setActiveSession
  // =========================================================================
  describe('setActiveSession', () => {
    it('should set the active session id', () => {
      useSessionStore.getState().setActiveSession('sess-1')
      expect(useSessionStore.getState().activeSessionId).toBe('sess-1')
    })

    it('should update the active session id', () => {
      useSessionStore.getState().setActiveSession('sess-1')
      useSessionStore.getState().setActiveSession('sess-2')
      expect(useSessionStore.getState().activeSessionId).toBe('sess-2')
    })
  })

  // =========================================================================
  // updateCurrentPath
  // =========================================================================
  describe('updateCurrentPath', () => {
    it('should update the current path of the specified session', () => {
      const session = makeSession()
      useSessionStore.setState({ sessions: [session] })
      useSessionStore.getState().updateCurrentPath('sess-1', '/var/log')
      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.currentPath).toBe('/var/log')
    })

    it('should not affect other sessions', () => {
      const s1 = makeSession({ sessionId: 'sess-1', currentPath: '/home' })
      const s2 = makeSession({ sessionId: 'sess-2', currentPath: '/tmp' })
      useSessionStore.setState({ sessions: [s1, s2] })
      useSessionStore.getState().updateCurrentPath('sess-1', '/var')
      const found = useSessionStore.getState().getSessionById('sess-2')
      if (!found) throw new Error('session not found')
      expect(found.currentPath).toBe('/tmp')
    })
  })

  // =========================================================================
  // setLoading
  // =========================================================================
  describe('setLoading', () => {
    it('should set loading state for the specified session', () => {
      const session = makeSession({ isLoading: false })
      useSessionStore.setState({ sessions: [session] })
      useSessionStore.getState().setLoading('sess-1', true)
      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.isLoading).toBe(true)
    })

    it('should clear loading state', () => {
      const session = makeSession({ isLoading: true })
      useSessionStore.setState({ sessions: [session] })
      useSessionStore.getState().setLoading('sess-1', false)
      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.isLoading).toBe(false)
    })
  })

  // =========================================================================
  // setError
  // =========================================================================
  describe('setError', () => {
    it('should set error and mark session as disconnected', () => {
      const session = makeSession({ isConnected: true, error: null })
      useSessionStore.setState({ sessions: [session] })
      useSessionStore.getState().setError('sess-1', 'Connection lost')
      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.error).toBe('Connection lost')
      expect(s.isConnected).toBe(false)
    })

    it('should clear error and mark session as connected', () => {
      const session = makeSession({ isConnected: false, error: 'Some error' })
      useSessionStore.setState({ sessions: [session] })
      useSessionStore.getState().setError('sess-1', null)
      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.error).toBeNull()
      expect(s.isConnected).toBe(true)
    })
  })

  // =========================================================================
  // getSessionById
  // =========================================================================
  describe('getSessionById', () => {
    it('should return the session matching the id', () => {
      const s1 = makeSession({ sessionId: 'sess-1' })
      const s2 = makeSession({ sessionId: 'sess-2' })
      useSessionStore.setState({ sessions: [s1, s2] })
      const found = useSessionStore.getState().getSessionById('sess-1')
      expect(found?.sessionId).toBe('sess-1')
    })

    it('should return undefined for non-existent id', () => {
      useSessionStore.setState({ sessions: [makeSession()] })
      expect(useSessionStore.getState().getSessionById('no-such')).toBeUndefined()
    })
  })

  // =========================================================================
  // getSessionByConnectionId
  // =========================================================================
  describe('getSessionByConnectionId', () => {
    it('should return the session matching the connection id', () => {
      const s1 = makeSession({ connectionId: 'conn-1' })
      const s2 = makeSession({ sessionId: 'sess-2', connectionId: 'conn-2' })
      useSessionStore.setState({ sessions: [s1, s2] })
      const found = useSessionStore.getState().getSessionByConnectionId('conn-2')
      expect(found?.sessionId).toBe('sess-2')
    })

    it('should return undefined for non-existent connection id', () => {
      useSessionStore.setState({ sessions: [makeSession()] })
      expect(useSessionStore.getState().getSessionByConnectionId('no-such')).toBeUndefined()
    })
  })

  // =========================================================================
  // refreshCurrentDirectory
  // =========================================================================
  describe('refreshCurrentDirectory', () => {
    it('should do nothing if session does not exist', async () => {
      await useSessionStore.getState().refreshCurrentDirectory('no-such')
      expect(mockProtocolList).not.toHaveBeenCalled()
    })

    it('should list files and update session on success', async () => {
      const files = [makeFileInfo()]
      mockProtocolList.mockResolvedValue(okResponse(files))
      const session = makeSession()
      useSessionStore.setState({ sessions: [session] })

      await useSessionStore.getState().refreshCurrentDirectory('sess-1')

      expect(mockGenerateUuid).toHaveBeenCalled()
      expect(mockProtocolList).toHaveBeenCalledWith('sess-1', '/home', 'uuid-1')

      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.files).toHaveLength(1)
      expect(s.files[0]?.name).toBe('test.txt')
      expect(s.isLoading).toBe(false)
    })

    it('should set error and empty files on error response', async () => {
      mockProtocolList.mockResolvedValue(errResponse('Network error'))
      const session = makeSession()
      useSessionStore.setState({ sessions: [session] })

      await useSessionStore.getState().refreshCurrentDirectory('sess-1')

      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.error).toBe('{"code":"ERR","message":"Network error"}')
      expect(s.files).toEqual([])
      expect(s.isLoading).toBe(false)
    })

    it('should cancel previous request when a new one starts', async () => {
      mockGenerateUuid.mockReturnValueOnce('uuid-old').mockReturnValueOnce('uuid-new')

      // First call hangs
      let resolveFirst: (value: unknown) => void = () => {}
      mockProtocolList.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve
          })
      )
      mockProtocolList.mockResolvedValueOnce(okResponse([]))

      const session = makeSession()
      useSessionStore.setState({ sessions: [session] })

      // Start first refresh (doesn't await)
      const firstPromise = useSessionStore.getState().refreshCurrentDirectory('sess-1')

      // Start second refresh
      const secondPromise = useSessionStore.getState().refreshCurrentDirectory('sess-1')

      // Resolve first (stale) call
      resolveFirst(okResponse([makeFileInfo({ name: 'stale.txt' })]))

      await firstPromise
      await secondPromise

      expect(mockProtocolCancel).toHaveBeenCalledWith('uuid-old')

      // The final state should reflect the second request
      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      expect(s.isLoading).toBe(false)
    })

    it('should ignore stale response when requestId no longer matches', async () => {
      mockGenerateUuid.mockReturnValueOnce('uuid-old').mockReturnValueOnce('uuid-new')

      let resolveFirst: (value: unknown) => void = () => {}
      mockProtocolList.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve
          })
      )
      mockProtocolList.mockResolvedValueOnce(okResponse([makeFileInfo({ name: 'fresh.txt' })]))

      const session = makeSession()
      useSessionStore.setState({ sessions: [session] })

      // Start first refresh (stale)
      const firstPromise = useSessionStore.getState().refreshCurrentDirectory('sess-1')

      // Start second refresh
      const secondPromise = useSessionStore.getState().refreshCurrentDirectory('sess-1')
      await secondPromise

      // Now resolve the stale first request with different data
      resolveFirst(okResponse([makeFileInfo({ name: 'stale.txt' })]))
      await firstPromise

      const s = useSessionStore.getState().getSessionById('sess-1')
      if (!s) throw new Error('session not found')
      // Files should be from the second (fresh) request, not the stale one
      expect(s.files).toHaveLength(1)
      expect(s.files[0]?.name).toBe('fresh.txt')
    })

    it('should set loading and clear error at start', async () => {
      const session = makeSession({ error: 'old error', isLoading: false })
      useSessionStore.setState({ sessions: [session] })
      mockProtocolList.mockResolvedValue(okResponse([]))

      // We need to check state between start and finish
      let resolveList: (value: unknown) => void = () => {}
      mockProtocolList.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveList = resolve
          })
      )

      const refreshPromise = useSessionStore.getState().refreshCurrentDirectory('sess-1')

      // Check loading state before resolution
      const loadingState = useSessionStore.getState().getSessionById('sess-1')
      if (!loadingState) throw new Error('session not found')
      expect(loadingState.isLoading).toBe(true)
      expect(loadingState.error).toBeNull()

      resolveList(okResponse([]))
      await refreshPromise
    })
  })
})

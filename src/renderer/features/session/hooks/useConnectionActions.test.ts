import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'

// Mock stores following project convention (simple selector pattern)
const mockConnectSession = vi.fn()
const mockReconnectSession = vi.fn()
vi.mock('./use-session-connect.js', () => ({
  useSessionConnect: () => ({
    connectSession: mockConnectSession,
    reconnectSession: mockReconnectSession,
  }),
}))

const mockRemoveSession = vi.fn()
const mockGetSessionByConnectionId = vi.fn()
vi.mock('../stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      removeSession: mockRemoveSession,
      getSessionByConnectionId: mockGetSessionByConnectionId,
    }),
}))

const mockAddConnection = vi.fn()
const mockUpdateConnection = vi.fn()
const mockDeleteConnection = vi.fn()
const mockSaveConnectionConfigs = vi.fn()
const mockConnections: ConnectionConfig[] = []
vi.mock('../stores/connection.js', () => ({
  useConnectionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      connections: mockConnections,
      addConnection: mockAddConnection,
      updateConnection: mockUpdateConnection,
      deleteConnection: mockDeleteConnection,
      saveConnectionConfigs: mockSaveConnectionConfigs,
    }),
}))

const mockAddToast = vi.fn()
vi.mock('@renderer/stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}))

vi.mock('@renderer/utils/index.js', () => ({
  logger: {
    catch: vi.fn(),
  },
}))

vi.mock('../utils/password-crypto.js', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted-pw'),
  decryptPassword: vi.fn().mockResolvedValue('decrypted-pw'),
}))

vi.mock('@renderer/hooks/use-active-task-guard.js', () => ({
  useActiveTaskGuard: () => ({
    guard: (action: () => void) => action(),
    confirmOpen: false,
    handleConfirm: vi.fn(),
    handleCancel: vi.fn(),
    title: 'confirm-title',
    message: 'confirm-message',
  }),
}))

// Mock window.electronAPI following project convention (vi.stubGlobal)
const mockProtocolDisconnect = vi.fn()
vi.stubGlobal('window', {
  electronAPI: {
    protocol: { disconnect: mockProtocolDisconnect },
  },
})

import { useConnectionActions } from './use-connection-actions.js'

const baseConfig = {
  name: 'Test Server',
  protocol: 'sftp',
  host: '192.168.1.1',
  port: 22,
  username: 'admin',
} as const

const fullConnection: ConnectionConfig = {
  id: 'conn-1',
  name: 'Test Server',
  protocol: 'sftp',
  host: '192.168.1.1',
  port: 22,
  username: 'admin',
  savePassword: false,
  password: '',
  basePath: '',
  scheme: 'https',
  rejectUnauthorized: true,
}

describe('useConnectionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConnections.length = 0
    mockConnections.push({ ...fullConnection })
  })

  describe('handleSaveConnection', () => {
    it('should create new connection on success', async () => {
      mockConnectSession.mockResolvedValue(true)
      mockSaveConnectionConfigs.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConnectionActions())
      const onSuccess = vi.fn()

      await act(async () => {
        await result.current.handleSaveConnection(
          { ...baseConfig, password: 'secret', savePassword: true },
          onSuccess,
        )
      })

      expect(mockConnectSession).toHaveBeenCalledOnce()
      expect(mockAddConnection).toHaveBeenCalledOnce()
      expect(mockSaveConnectionConfigs).toHaveBeenCalledOnce()
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: TOAST_TYPE.SUCCESS }),
      )
      expect(onSuccess).toHaveBeenCalledOnce()
    })

    it('should update existing connection when editing', async () => {
      mockConnectSession.mockResolvedValue(true)
      mockSaveConnectionConfigs.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConnectionActions())
      act(() => {
        result.current.setEditConfig({ ...fullConnection })
      })

      await act(async () => {
        await result.current.handleSaveConnection({ ...baseConfig, password: 'new-pw' })
      })

      expect(mockUpdateConnection).toHaveBeenCalledOnce()
      expect(mockAddConnection).not.toHaveBeenCalled()
    })

    it('should show error toast when connectSession fails', async () => {
      mockConnectSession.mockResolvedValue(false)

      const { result } = renderHook(() => useConnectionActions())

      await act(async () => {
        try {
          await result.current.handleSaveConnection({ ...baseConfig, password: 'pw' })
        } catch {
          // handleSaveConnection throws on failure
        }
      })

      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: TOAST_TYPE.ERROR }))
    })

    it('should show error toast when password encryption fails', async () => {
      const { encryptPassword } = await import('../utils/password-crypto.js')
      vi.mocked(encryptPassword).mockRejectedValueOnce(new Error('encrypt failed'))

      const { result } = renderHook(() => useConnectionActions())

      await act(async () => {
        try {
          await result.current.handleSaveConnection({ ...baseConfig, password: 'pw' })
        } catch {
          // encrypt failure throws
        }
      })

      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: TOAST_TYPE.ERROR }))
    })
  })

  describe('handleDisconnect', () => {
    it('should disconnect session when session exists', async () => {
      mockGetSessionByConnectionId.mockReturnValue({ sessionId: 'sess-1' })
      mockProtocolDisconnect.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConnectionActions())

      act(() => {
        result.current.handleDisconnect('conn-1')
      })

      await vi.waitFor(() => {
        expect(mockProtocolDisconnect).toHaveBeenCalledWith('sess-1')
      })
      expect(mockRemoveSession).toHaveBeenCalledWith('sess-1')
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: TOAST_TYPE.INFO }))
    })

    it('should show info toast when no active session', async () => {
      mockGetSessionByConnectionId.mockReturnValue(null)

      const { result } = renderHook(() => useConnectionActions())

      act(() => {
        result.current.handleDisconnect('conn-1')
      })

      await vi.waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: TOAST_TYPE.INFO }),
        )
      })
      expect(mockRemoveSession).not.toHaveBeenCalled()
    })
  })

  describe('handleDelete', () => {
    it('should open delete confirmation dialog', () => {
      const { result } = renderHook(() => useConnectionActions())

      act(() => {
        result.current.handleDelete('conn-1')
      })

      expect(result.current.deleteConfirmOpen).toBe(true)
      expect(result.current.connectionToDelete).toBe('conn-1')
    })
  })

  describe('handleConfirmDelete', () => {
    it('should disconnect session and delete connection', async () => {
      mockGetSessionByConnectionId.mockReturnValue({ sessionId: 'sess-1' })
      mockDeleteConnection.mockResolvedValue(undefined)
      mockProtocolDisconnect.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConnectionActions())

      act(() => {
        result.current.handleDelete('conn-1')
      })

      await act(async () => {
        await result.current.handleConfirmDelete()
      })

      expect(mockProtocolDisconnect).toHaveBeenCalledWith('sess-1')
      expect(mockRemoveSession).toHaveBeenCalledWith('sess-1')
      expect(mockDeleteConnection).toHaveBeenCalledWith('conn-1')
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: TOAST_TYPE.INFO }))
      expect(result.current.deleteConfirmOpen).toBe(false)
      expect(result.current.connectionToDelete).toBeNull()
    })

    it('should show error toast when delete fails', async () => {
      mockGetSessionByConnectionId.mockReturnValue(null)
      mockDeleteConnection.mockRejectedValue(new Error('delete failed'))

      const { result } = renderHook(() => useConnectionActions())

      act(() => {
        result.current.handleDelete('conn-1')
      })

      await act(async () => {
        await result.current.handleConfirmDelete()
      })

      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: TOAST_TYPE.ERROR }))
      expect(result.current.deleteConfirmOpen).toBe(false)
    })

    it('should do nothing when connectionToDelete is null', async () => {
      const { result } = renderHook(() => useConnectionActions())

      await act(async () => {
        await result.current.handleConfirmDelete()
      })

      expect(mockDeleteConnection).not.toHaveBeenCalled()
    })
  })

  describe('handleReconnect', () => {
    it('should reconnect directly when saved password decrypts and connects', async () => {
      mockReconnectSession.mockResolvedValue(true)

      const { result } = renderHook(() => useConnectionActions())
      const onOpenDialog = vi.fn()
      const connection = { ...fullConnection, password: 'encrypted-pw' }

      await act(async () => {
        await result.current.handleReconnect(connection, onOpenDialog)
      })

      expect(mockReconnectSession).toHaveBeenCalledWith('conn-1', {
        password: 'encrypted-pw',
      })
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: TOAST_TYPE.SUCCESS }),
      )
      expect(onOpenDialog).not.toHaveBeenCalled()
    })

    it('should open reconnect dialog when connection fails', async () => {
      mockReconnectSession.mockResolvedValue(false)

      const { result } = renderHook(() => useConnectionActions())
      const onOpenDialog = vi.fn()
      const connection = { ...fullConnection, password: 'encrypted-pw' }

      await act(async () => {
        await result.current.handleReconnect(connection, onOpenDialog)
      })

      expect(result.current.reconnectConfig).toBe(connection)
      expect(onOpenDialog).toHaveBeenCalledOnce()
    })

    it('should open reconnect dialog when no saved password', async () => {
      const { result } = renderHook(() => useConnectionActions())
      const onOpenDialog = vi.fn()
      const connection = { ...fullConnection, password: '' }

      await act(async () => {
        await result.current.handleReconnect(connection, onOpenDialog)
      })

      expect(result.current.reconnectConfig).toBe(connection)
      expect(onOpenDialog).toHaveBeenCalledOnce()
    })
  })

  describe('handleEdit', () => {
    it('should disconnect session before editing', async () => {
      mockGetSessionByConnectionId.mockReturnValue({ sessionId: 'sess-1' })
      mockProtocolDisconnect.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConnectionActions())
      const onOpenDialog = vi.fn()

      await act(async () => {
        await result.current.handleEdit(fullConnection, onOpenDialog)
      })

      expect(mockProtocolDisconnect).toHaveBeenCalledWith('sess-1')
      expect(mockRemoveSession).toHaveBeenCalledWith('sess-1')
      expect(result.current.editConfig).toEqual(fullConnection)
      expect(onOpenDialog).toHaveBeenCalledOnce()
    })

    it('should set editConfig without disconnect when no active session', async () => {
      mockGetSessionByConnectionId.mockReturnValue(null)

      const { result } = renderHook(() => useConnectionActions())
      const onOpenDialog = vi.fn()

      await act(async () => {
        await result.current.handleEdit(fullConnection, onOpenDialog)
      })

      expect(result.current.editConfig).toEqual(fullConnection)
      expect(onOpenDialog).toHaveBeenCalledOnce()
    })
  })
})

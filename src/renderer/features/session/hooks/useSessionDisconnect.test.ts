import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@shared/types/index.js'
import { useSessionDisconnect } from './useSessionDisconnect.js'

const mockRemoveSession = vi.fn()
const mockAddToast = vi.fn()
const mockGetSessionByConnectionId = vi.fn()
const mockUnsubscribe = vi.fn()

let capturedCallback:
  | ((event: { connectionId: string; protocol: string; name: string }) => void)
  | null = null

const mockOnSessionDisconnected = vi.fn(
  (cb: (event: { connectionId: string; protocol: string; name: string }) => void) => {
    capturedCallback = cb
    return mockUnsubscribe
  }
)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'toast.connectionLost' && params) {
        return `${key}: ${params.protocol} ${params.name}`
      }
      return key
    },
    i18n: { language: 'en-US' },
  }),
}))

vi.mock('@renderer/features/session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      removeSession: mockRemoveSession,
      getSessionByConnectionId: mockGetSessionByConnectionId,
    }),
}))

vi.mock('@renderer/stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}))

describe('useSessionDisconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    mockOnSessionDisconnected.mockClear()

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    ;(window as any).electronAPI = {
      protocol: {
        onSessionDisconnected: mockOnSessionDisconnected,
      },
    }
  })

  it('should subscribe to onSessionDisconnected on mount', () => {
    renderHook(() => useSessionDisconnect())
    expect(mockOnSessionDisconnected).toHaveBeenCalledTimes(1)
  })

  it('should remove local session on disconnect event', () => {
    const mockSession: Session = {
      sessionId: 'sess-1',
      connectionId: 'conn-1',
      currentPath: '/home',
      files: [],
      isConnected: true,
      isLoading: false,
      isOperating: false,
      error: null,
    }
    mockGetSessionByConnectionId.mockReturnValue(mockSession)

    renderHook(() => useSessionDisconnect())

    if (!capturedCallback) throw new Error('Callback not registered')
    capturedCallback({ connectionId: 'conn-1', protocol: 'sftp', name: 'TestServer' })

    expect(mockGetSessionByConnectionId).toHaveBeenCalledWith('conn-1')
    expect(mockRemoveSession).toHaveBeenCalledWith('sess-1')
  })

  it('should show disconnect toast notification', () => {
    const mockSession: Session = {
      sessionId: 'sess-1',
      connectionId: 'conn-1',
      currentPath: '/home',
      files: [],
      isConnected: true,
      isLoading: false,
      isOperating: false,
      error: null,
    }
    mockGetSessionByConnectionId.mockReturnValue(mockSession)

    renderHook(() => useSessionDisconnect())

    if (!capturedCallback) throw new Error('Callback not registered')
    capturedCallback({ connectionId: 'conn-1', protocol: 'sftp', name: 'TestServer' })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.connectionLost: SFTP TestServer',
    })
  })

  it('should not remove session if no session found for connection', () => {
    mockGetSessionByConnectionId.mockReturnValue(undefined)

    renderHook(() => useSessionDisconnect())

    if (!capturedCallback) throw new Error('Callback not registered')
    capturedCallback({ connectionId: 'conn-unknown', protocol: 'webdav', name: 'UnknownServer' })

    expect(mockRemoveSession).not.toHaveBeenCalled()
    expect(mockAddToast).toHaveBeenCalled()
  })

  it('should still show toast even when no session found', () => {
    mockGetSessionByConnectionId.mockReturnValue(undefined)

    renderHook(() => useSessionDisconnect())

    if (!capturedCallback) throw new Error('Callback not registered')
    capturedCallback({ connectionId: 'conn-unknown', protocol: 'webdav', name: 'WebDAVServer' })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'toast.connectionLost: WEBDAV WebDAVServer',
    })
  })
})

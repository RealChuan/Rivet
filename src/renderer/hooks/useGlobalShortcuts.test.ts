import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '../features/session/stores/session.js'
import { useGlobalShortcuts } from './use-global-shortcuts.js'

const mockInvalidateSession = vi.fn().mockResolvedValue(undefined)

vi.mock('../features/file-explorer/hooks/index.js', () => ({
  useDirectoryInvalidation: () => ({
    invalidateSession: mockInvalidateSession,
    invalidatePath: vi.fn(),
  }),
}))

vi.mock('../features/session/stores/session.js', () => ({
  useSessionStore: vi.fn(),
}))

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    mockInvalidateSession.mockClear()
    ;(window as unknown as Record<string, unknown>).electronAPI = {
      transfer: {},
      window: {},
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  function setupMocks(activeSessionId: string | null = 'session-1') {
    const mockState = {
      activeSessionId,
      sessions: activeSessionId ? [{ sessionId: activeSessionId, connectionId: 'conn-1' }] : [],
    }
    ;(useSessionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState),
    )
  }

  it('should register a keydown event listener on mount', () => {
    setupMocks()
    const addSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useGlobalShortcuts())

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    addSpy.mockRestore()
  })

  it('should remove keydown event listener on unmount', () => {
    setupMocks()
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useGlobalShortcuts())
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('should invalidate the active session directory on F5', () => {
    setupMocks('session-1')

    renderHook(() => useGlobalShortcuts())

    const event = new KeyboardEvent('keydown', { key: 'F5' })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(mockInvalidateSession).toHaveBeenCalledWith('session-1')
  })

  it('should not invalidate when activeSessionId is null', () => {
    setupMocks(null)

    renderHook(() => useGlobalShortcuts())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }))

    expect(mockInvalidateSession).not.toHaveBeenCalled()
  })

  it('should not invalidate on non-F5 keys', () => {
    setupMocks('session-1')

    renderHook(() => useGlobalShortcuts())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(mockInvalidateSession).not.toHaveBeenCalled()
  })
})

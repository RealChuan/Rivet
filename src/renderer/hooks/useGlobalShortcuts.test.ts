import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGlobalShortcuts } from './useGlobalShortcuts.js'
import { useSessionStore } from '../features/session/stores/session.js'

vi.mock('../features/session/stores/session.js', () => ({
  useSessionStore: vi.fn(),
}))

describe('useGlobalShortcuts', () => {
  const mockRefreshCurrentDirectory = vi.fn().mockResolvedValue(undefined)

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  function setupMocks(activeSessionId: string | null = 'session-1') {
    const mockState = {
      refreshCurrentDirectory: mockRefreshCurrentDirectory,
      activeSessionId,
    }
    ;(useSessionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
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

  it('should call refreshCurrentDirectory on F5 key press with activeSessionId', () => {
    setupMocks('session-1')

    renderHook(() => useGlobalShortcuts())

    const event = new KeyboardEvent('keydown', { key: 'F5' })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(mockRefreshCurrentDirectory).toHaveBeenCalledWith('session-1')
  })

  it('should not call refreshCurrentDirectory when activeSessionId is null', () => {
    setupMocks(null)

    renderHook(() => useGlobalShortcuts())

    const event = new KeyboardEvent('keydown', { key: 'F5' })
    window.dispatchEvent(event)

    expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
  })

  it('should not call refreshCurrentDirectory on non-F5 keys', () => {
    setupMocks('session-1')

    renderHook(() => useGlobalShortcuts())

    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    window.dispatchEvent(event)

    expect(mockRefreshCurrentDirectory).not.toHaveBeenCalled()
  })
})

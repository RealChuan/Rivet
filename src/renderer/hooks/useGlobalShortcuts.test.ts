import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '../features/session/stores/session.js'
import { useGlobalShortcuts } from './useGlobalShortcuts.js'

vi.mock('../features/session/stores/session.js', () => ({
  useSessionStore: vi.fn(),
}))

describe('useGlobalShortcuts', () => {
  const mockRefreshCurrentDirectory = vi.fn().mockResolvedValue(undefined)
  const mockUnsubscribe = vi.fn()
  const mockOnHasActiveTasks = vi.fn<(cb: () => void) => typeof mockUnsubscribe>(
    () => mockUnsubscribe
  )
  const mockCancelAll = vi.fn().mockResolvedValue(undefined)
  const mockWindowClose = vi.fn()

  beforeEach(() => {
    ;(window as unknown as Record<string, unknown>).electronAPI = {
      transfer: {
        onHasActiveTasks: mockOnHasActiveTasks,
        cancelAll: mockCancelAll,
      },
      window: {
        close: mockWindowClose,
      },
    }
  })

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

  it('should subscribe to onHasActiveTasks on mount', () => {
    setupMocks()

    renderHook(() => useGlobalShortcuts())

    expect(mockOnHasActiveTasks).toHaveBeenCalledTimes(1)
  })

  it('should unsubscribe from onHasActiveTasks on unmount', () => {
    setupMocks()

    const { unmount } = renderHook(() => useGlobalShortcuts())
    unmount()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('should open quit confirm dialog when onHasActiveTasks fires', () => {
    setupMocks()
    let capturedCallback: (() => void) | undefined
    mockOnHasActiveTasks.mockImplementation((cb: unknown) => {
      capturedCallback = cb as () => void
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useGlobalShortcuts())

    expect(capturedCallback).toBeDefined()
    act(() => {
      capturedCallback?.()
    })

    expect(result.current.quitConfirmOpen).toBe(true)
  })

  it('should cancel all transfers and close window on confirm quit', async () => {
    setupMocks()

    const { result } = renderHook(() => useGlobalShortcuts())

    await result.current.handleConfirmQuit()

    expect(mockCancelAll).toHaveBeenCalled()
    expect(mockWindowClose).toHaveBeenCalled()
  })
})

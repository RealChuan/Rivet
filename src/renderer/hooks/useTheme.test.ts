import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SORT_ORDER } from '@shared/constants/index.js'
import { useUiStore } from '../stores/index.js'
import { useApplicationTheme } from './use-theme.js'

vi.mock('../stores/index.js', () => ({
  useUiStore: vi.fn(),
}))

vi.mock('@renderer/features/session/stores/connection.js', () => ({
  useConnectionStore: vi.fn(),
}))

import { useConnectionStore } from '@renderer/features/session/stores/connection.js'

describe('useApplicationTheme', () => {
  const mockSetAppearance = vi.fn()

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return default theme', () => {
    const mockState = {
      appearance: 'system',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )

    const { result } = renderHook(() => useApplicationTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('should cycle theme from light to dark', () => {
    const mockState = {
      appearance: 'light',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )

    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.cycleTheme()
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('dark', SORT_ORDER.NONE)
  })

  it('should cycle theme from dark to system', () => {
    const mockState = {
      appearance: 'dark',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )

    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.cycleTheme()
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('system', SORT_ORDER.NONE)
  })

  it('should handle dark mode appearance', () => {
    const mockState = {
      appearance: 'dark',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )

    const { result } = renderHook(() => useApplicationTheme())
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('should handle light mode appearance', () => {
    const mockState = {
      appearance: 'light',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )

    const { result } = renderHook(() => useApplicationTheme())
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('should call setTheme with new theme', () => {
    const mockState = {
      appearance: 'system',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )

    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.setTheme('dark')
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('dark', SORT_ORDER.NONE)
  })
})

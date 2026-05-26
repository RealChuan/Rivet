import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApplicationTheme } from './useTheme.js'
import { useUiStore } from '../stores/index.js'

vi.mock('../stores/index.js', () => ({
  useUiStore: vi.fn(),
}))

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

    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.cycleTheme()
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('dark')
  })

  it('should cycle theme from dark to system', () => {
    const mockState = {
      appearance: 'dark',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )

    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.cycleTheme()
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('system')
  })

  it('should handle dark mode appearance', () => {
    const mockState = {
      appearance: 'dark',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
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

    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.setTheme('dark')
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('dark')
  })
})

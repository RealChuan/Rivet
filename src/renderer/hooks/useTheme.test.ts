import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../stores/index.js'
import { useApplicationTheme } from './use-theme.js'

vi.mock('../stores/index.js', () => ({
  useUiStore: vi.fn(),
}))

describe('useApplicationTheme', () => {
  const mockSetAppearance = vi.fn()

  afterEach(() => {
    vi.clearAllMocks()
  })

  function setupMocks(appearance: string = 'system') {
    const mockState = {
      appearance,
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState),
    )
    vi.stubGlobal('electronAPI', {
      window: { getState: vi.fn().mockResolvedValue({ platform: 'win32' }) },
      system: { supportsGlass: vi.fn().mockResolvedValue(true) },
    })
  }

  it('should return default theme', () => {
    setupMocks('system')
    const { result } = renderHook(() => useApplicationTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('should cycle theme from light to dark', () => {
    setupMocks('light')
    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.cycleTheme()
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('dark')
  })

  it('should cycle theme from dark to system', () => {
    setupMocks('dark')
    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.cycleTheme()
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('system')
  })

  it('should handle dark mode appearance', () => {
    setupMocks('dark')
    const { result } = renderHook(() => useApplicationTheme())
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('should handle light mode appearance', () => {
    setupMocks('light')
    const { result } = renderHook(() => useApplicationTheme())
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('should call setTheme with new theme', () => {
    setupMocks('system')
    const { result } = renderHook(() => useApplicationTheme())
    act(() => {
      result.current.setTheme('dark')
    })
    expect(mockSetAppearance).toHaveBeenCalledWith('dark')
  })

  it('should add no-glass class when supportsGlass is false', async () => {
    const mockState = {
      appearance: 'system',
      setAppearance: mockSetAppearance,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState),
    )
    const mockSupportsGlass = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('electronAPI', {
      system: { supportsGlass: mockSupportsGlass },
    })

    renderHook(() => useApplicationTheme())

    await vi.waitFor(() => {
      expect(mockSupportsGlass).toHaveBeenCalled()
    })
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('no-glass')
  })
})

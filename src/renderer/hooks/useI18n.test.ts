import { renderHook } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../stores/index.js'
import { useInternationalization } from './use-i18n.js'

vi.mock('../stores/index.js', () => ({
  useUiStore: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(),
}))

describe('useInternationalization', () => {
  const mockSetLocale = vi.fn()
  const mockChangeLanguage = vi.fn().mockResolvedValue({})

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return current language', () => {
    const mockState = {
      locale: 'zh-CN',
      setLocale: mockSetLocale,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useTranslation as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      i18n: {
        changeLanguage: mockChangeLanguage,
      },
    })

    const { result } = renderHook(() => useInternationalization())
    expect(result.current.language).toBe('zh-CN')
  })

  it('should change language', () => {
    const mockState = {
      locale: 'zh-CN',
      setLocale: mockSetLocale,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockState) => unknown) => selector(mockState)
    )
    ;(useTranslation as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      i18n: {
        changeLanguage: mockChangeLanguage,
      },
    })

    const { result } = renderHook(() => useInternationalization())
    result.current.changeLanguage('en-US')
    expect(mockChangeLanguage).toHaveBeenCalledWith('en-US')
    expect(mockSetLocale).toHaveBeenCalledWith('en-US')
  })
})

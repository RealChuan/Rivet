import { renderHook } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SORT_ORDER } from '@shared/constants/index.js'
import { useUiStore } from '../stores/index.js'
import { useInternationalization } from './use-i18n.js'

vi.mock('../stores/index.js', () => ({
  useUiStore: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(),
}))

vi.mock('@renderer/features/session/stores/connection.js', () => ({
  useConnectionStore: vi.fn(),
}))

import { useConnectionStore } from '@renderer/features/session/stores/connection.js'

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
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
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
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { sortOrder: string }) => unknown) =>
        selector({ sortOrder: SORT_ORDER.NONE })
    )
    ;(useTranslation as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      i18n: {
        changeLanguage: mockChangeLanguage,
      },
    })

    const { result } = renderHook(() => useInternationalization())
    result.current.changeLanguage('en-US')
    expect(mockChangeLanguage).toHaveBeenCalledWith('en-US')
    expect(mockSetLocale).toHaveBeenCalledWith('en-US', SORT_ORDER.NONE)
  })
})

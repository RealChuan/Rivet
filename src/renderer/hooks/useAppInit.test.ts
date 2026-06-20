import { renderHook, waitFor } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from '../features/session/stores/connection.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'
import { useUiStore } from '../stores/index.js'
import { useApplicationInitialization } from './use-app-init.js'

vi.mock('../stores/index.js', () => ({
  useUiStore: vi.fn(),
}))

vi.mock('../features/session/stores/connection.js', () => ({
  useConnectionStore: vi.fn(),
}))

vi.mock('../features/transfer/stores/transfer.js', () => ({
  useTransferStore: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(),
}))

vi.mock('../utils/logger.js', () => ({
  default: { catch: vi.fn() },
}))

describe('useApplicationInitialization', () => {
  const mockInitialize = vi.fn()
  const mockChangeLanguage = vi.fn().mockResolvedValue(undefined)
  const mockLoadSavedConnections = vi.fn().mockResolvedValue(undefined)
  const mockLoadSortOrderFromSettings = vi.fn().mockResolvedValue(undefined)
  const mockStartTransferListening = vi.fn(() => vi.fn())
  const mockLoadExistingTasks = vi.fn().mockResolvedValue(undefined)
  const mockConfigGet = vi.fn()

  afterEach(() => {
    vi.clearAllMocks()
  })

  function setupMocks() {
    const uiState = {
      initialize: mockInitialize,
      initialized: false,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof uiState) => unknown) => selector(uiState),
    )
    ;(useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (
        selector: (state: {
          loadSavedConnections: typeof mockLoadSavedConnections
          loadSortOrderFromSettings: typeof mockLoadSortOrderFromSettings
        }) => unknown,
      ) =>
        selector({
          loadSavedConnections: mockLoadSavedConnections,
          loadSortOrderFromSettings: mockLoadSortOrderFromSettings,
        }),
    )
    ;(useTransferStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (
        selector: (state: {
          startListening: typeof mockStartTransferListening
          loadExistingTasks: typeof mockLoadExistingTasks
        }) => unknown,
      ) =>
        selector({
          startListening: mockStartTransferListening,
          loadExistingTasks: mockLoadExistingTasks,
        }),
    )
    ;(useTranslation as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      i18n: { changeLanguage: mockChangeLanguage },
    })
    vi.stubGlobal('electronAPI', {
      config: { get: mockConfigGet },
    })
  }

  it('should return { initialized } shape', () => {
    setupMocks()
    mockConfigGet.mockResolvedValue({ success: true, value: null })

    const { result } = renderHook(() => useApplicationInitialization())
    expect(result.current).toHaveProperty('initialized')
  })

  it('should call config.get with UI_SETTINGS key on mount', async () => {
    setupMocks()
    mockConfigGet.mockResolvedValue({ success: true, value: null })

    renderHook(() => useApplicationInitialization())

    await waitFor(() => {
      expect(mockConfigGet).toHaveBeenCalled()
    })
  })

  it('should initialize with saved settings and change language', async () => {
    setupMocks()
    const savedSettings = { appearance: 'dark', locale: 'zh-CN' }
    mockConfigGet.mockResolvedValue({ success: true, value: savedSettings })

    renderHook(() => useApplicationInitialization())

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith({
        appearance: 'dark',
        locale: 'zh-CN',
      })
      expect(mockChangeLanguage).toHaveBeenCalledWith('zh-CN')
    })
  })

  it('should use defaults when saved settings are null', async () => {
    setupMocks()
    mockConfigGet.mockResolvedValue({ success: true, value: null })

    renderHook(() => useApplicationInitialization())

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled()
      expect(mockChangeLanguage).toHaveBeenCalled()
    })
  })

  it('should use defaults when config.get returns error', async () => {
    setupMocks()
    mockConfigGet.mockResolvedValue({ success: false, error: new Error('fail') })

    renderHook(() => useApplicationInitialization())

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled()
      expect(mockChangeLanguage).toHaveBeenCalled()
    })
  })

  it('should load saved connections when initialized becomes true', async () => {
    setupMocks()
    mockConfigGet.mockResolvedValue({ success: true, value: null })

    // First render: initialized = false
    const { rerender } = renderHook(() => useApplicationInitialization())

    // Simulate initialized becoming true
    const uiState = {
      initialize: mockInitialize,
      initialized: true,
    }
    ;(useUiStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof uiState) => unknown) => selector(uiState),
    )
    ;(useTransferStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (
        selector: (state: {
          startListening: typeof mockStartTransferListening
          loadExistingTasks: typeof mockLoadExistingTasks
        }) => unknown,
      ) =>
        selector({
          startListening: mockStartTransferListening,
          loadExistingTasks: mockLoadExistingTasks,
        }),
    )

    rerender()

    await waitFor(() => {
      expect(mockLoadSavedConnections).toHaveBeenCalled()
      expect(mockLoadSortOrderFromSettings).toHaveBeenCalled()
      expect(mockStartTransferListening).toHaveBeenCalled()
      expect(mockLoadExistingTasks).toHaveBeenCalled()
    })
  })
})

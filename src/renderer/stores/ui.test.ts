import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_VALUE,
  SORT_ORDER,
  STORE_KEY,
  SUPPORTED_LANGUAGE,
  THEME,
  TIMEOUTS,
  TOAST_TYPE,
} from '@shared/constants/index.js'
import { useUiStore } from './ui.js'

const mockConfigSet = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    config: {
      set: mockConfigSet,
    },
  },
})

describe('useUiStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Reset store to initial state
    useUiStore.setState({
      appearance: DEFAULT_THEME_VALUE,
      locale: DEFAULT_LANGUAGE,
      connectionSortOrder: SORT_ORDER.NONE,
      connectionPanelWidth: 260,
      queueDrawerOpen: false,
      queueDrawerWidth: 360,
      initialized: false,
      toasts: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should have default appearance', () => {
      expect(useUiStore.getState().appearance).toBe(DEFAULT_THEME_VALUE)
    })

    it('should have default locale', () => {
      expect(useUiStore.getState().locale).toBe(DEFAULT_LANGUAGE)
    })

    it('should have default connectionSortOrder', () => {
      expect(useUiStore.getState().connectionSortOrder).toBe(SORT_ORDER.NONE)
    })

    it('should have default connectionPanelWidth of 260', () => {
      expect(useUiStore.getState().connectionPanelWidth).toBe(260)
    })

    it('should have default queueDrawerOpen as false', () => {
      expect(useUiStore.getState().queueDrawerOpen).toBe(false)
    })

    it('should have default queueDrawerWidth of 360', () => {
      expect(useUiStore.getState().queueDrawerWidth).toBe(360)
    })

    it('should have initialized as false', () => {
      expect(useUiStore.getState().initialized).toBe(false)
    })

    it('should have empty toasts array', () => {
      expect(useUiStore.getState().toasts).toEqual([])
    })
  })

  describe('setAppearance', () => {
    it('should update appearance in state', () => {
      useUiStore.getState().setAppearance(THEME.DARK)

      expect(useUiStore.getState().appearance).toBe(THEME.DARK)
    })

    it('should persist appearance via config.set', () => {
      useUiStore.getState().setAppearance(THEME.LIGHT)

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, {
        appearance: THEME.LIGHT,
        locale: DEFAULT_LANGUAGE,
        connectionSortOrder: SORT_ORDER.NONE,
      })
    })

    it('should include current locale and connectionSortOrder when persisting', () => {
      useUiStore.setState({ locale: SUPPORTED_LANGUAGE.ZH_CN, connectionSortOrder: SORT_ORDER.ASC })
      useUiStore.getState().setAppearance(THEME.DARK)

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, {
        appearance: THEME.DARK,
        locale: SUPPORTED_LANGUAGE.ZH_CN,
        connectionSortOrder: SORT_ORDER.ASC,
      })
    })
  })

  describe('setLocale', () => {
    it('should update locale in state', () => {
      useUiStore.getState().setLocale(SUPPORTED_LANGUAGE.ZH_CN)

      expect(useUiStore.getState().locale).toBe(SUPPORTED_LANGUAGE.ZH_CN)
    })

    it('should persist locale via config.set', () => {
      useUiStore.getState().setLocale(SUPPORTED_LANGUAGE.ZH_CN)

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, {
        appearance: DEFAULT_THEME_VALUE,
        locale: SUPPORTED_LANGUAGE.ZH_CN,
        connectionSortOrder: SORT_ORDER.NONE,
      })
    })

    it('should include current appearance and connectionSortOrder when persisting', () => {
      useUiStore.setState({ appearance: THEME.DARK, connectionSortOrder: SORT_ORDER.DESC })
      useUiStore.getState().setLocale(SUPPORTED_LANGUAGE.ZH_CN)

      expect(mockConfigSet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, {
        appearance: THEME.DARK,
        locale: SUPPORTED_LANGUAGE.ZH_CN,
        connectionSortOrder: SORT_ORDER.DESC,
      })
    })
  })

  describe('setConnectionPanelWidth', () => {
    it('should update connectionPanelWidth in state', () => {
      useUiStore.getState().setConnectionPanelWidth(300)

      expect(useUiStore.getState().connectionPanelWidth).toBe(300)
    })

    it('should not persist via config.set', () => {
      useUiStore.getState().setConnectionPanelWidth(300)

      expect(mockConfigSet).not.toHaveBeenCalled()
    })
  })

  describe('initialize', () => {
    it('should merge provided settings into state', () => {
      useUiStore.getState().initialize({
        appearance: THEME.DARK,
        locale: SUPPORTED_LANGUAGE.ZH_CN,
        connectionSortOrder: SORT_ORDER.ASC,
      })

      expect(useUiStore.getState().appearance).toBe(THEME.DARK)
      expect(useUiStore.getState().locale).toBe(SUPPORTED_LANGUAGE.ZH_CN)
      expect(useUiStore.getState().connectionSortOrder).toBe(SORT_ORDER.ASC)
    })

    it('should set initialized to true', () => {
      useUiStore.getState().initialize({})

      expect(useUiStore.getState().initialized).toBe(true)
    })

    it('should merge partial settings without overriding unspecified fields', () => {
      useUiStore.setState({ connectionPanelWidth: 300 })
      useUiStore.getState().initialize({ appearance: THEME.LIGHT })

      expect(useUiStore.getState().appearance).toBe(THEME.LIGHT)
      expect(useUiStore.getState().connectionPanelWidth).toBe(300)
    })

    it('should handle empty settings object', () => {
      useUiStore.getState().initialize({})

      expect(useUiStore.getState().initialized).toBe(true)
      expect(useUiStore.getState().appearance).toBe(DEFAULT_THEME_VALUE)
      expect(useUiStore.getState().locale).toBe(DEFAULT_LANGUAGE)
    })
  })

  describe('addToast', () => {
    it('should add a toast to the toasts array', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Operation succeeded',
      })

      expect(useUiStore.getState().toasts).toHaveLength(1)
      const toast0 = useUiStore.getState().toasts[0]
      if (!toast0) throw new Error('Expected toast')
      expect(toast0.type).toBe(TOAST_TYPE.SUCCESS)
      expect(toast0.message).toBe('Operation succeeded')
    })

    it('should generate a unique id starting with toast_', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.INFO,
        message: 'Test',
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      expect(toast.id).toMatch(/^toast_\d+$/)
    })

    it('should add multiple toasts', () => {
      useUiStore.getState().addToast({ type: TOAST_TYPE.SUCCESS, message: 'First' })
      vi.advanceTimersByTime(1)
      useUiStore.getState().addToast({ type: TOAST_TYPE.ERROR, message: 'Second' })

      expect(useUiStore.getState().toasts).toHaveLength(2)
    })

    it('should use default duration for SUCCESS toast (3000ms)', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Success',
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      expect(toast.timer).toBeDefined()
    })

    it('should use ERROR duration for ERROR toast (6000ms)', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.ERROR,
        message: 'Error',
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      expect(toast.timer).toBeDefined()
    })

    it('should auto-remove SUCCESS toast after default duration', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Auto remove',
      })

      expect(useUiStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(TIMEOUTS.TOAST_DEFAULT_DURATION)

      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should auto-remove ERROR toast after error duration', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.ERROR,
        message: 'Auto remove error',
      })

      expect(useUiStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(TIMEOUTS.TOAST_ERROR_DURATION)

      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should not auto-remove ERROR toast before error duration elapses', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.ERROR,
        message: 'Still visible',
      })

      vi.advanceTimersByTime(TIMEOUTS.TOAST_DEFAULT_DURATION)

      expect(useUiStore.getState().toasts).toHaveLength(1)
    })

    it('should not auto-remove toast when duration is 0 (persistent)', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.INFO,
        message: 'Persistent',
        duration: 0,
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      expect(toast.timer).toBeUndefined()

      vi.advanceTimersByTime(100000)

      expect(useUiStore.getState().toasts).toHaveLength(1)
    })

    it('should use custom duration when provided', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.INFO,
        message: 'Custom duration',
        duration: 5000,
      })

      expect(useUiStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(4999)
      expect(useUiStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should use default duration for INFO toast (non-ERROR)', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.INFO,
        message: 'Info toast',
      })

      vi.advanceTimersByTime(TIMEOUTS.TOAST_DEFAULT_DURATION - 1)
      expect(useUiStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should use default duration for WARNING toast (non-ERROR)', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.WARNING,
        message: 'Warning toast',
      })

      vi.advanceTimersByTime(TIMEOUTS.TOAST_DEFAULT_DURATION)

      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should not remove toast if already removed by removeToast before timer fires', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Manual remove',
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      const toastId = toast.id
      useUiStore.getState().removeToast(toastId)

      expect(useUiStore.getState().toasts).toHaveLength(0)

      // Timer fires but toast is already gone — should be a no-op
      vi.advanceTimersByTime(TIMEOUTS.TOAST_DEFAULT_DURATION)

      expect(useUiStore.getState().toasts).toHaveLength(0)
    })
  })

  describe('removeToast', () => {
    it('should remove a toast by id', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'To remove',
        duration: 0,
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      const toastId = toast.id
      useUiStore.getState().removeToast(toastId)

      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should clear the timer when removing a toast', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Timer clear',
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      const toastId = toast.id
      useUiStore.getState().removeToast(toastId)

      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })

    it('should not affect other toasts when removing one', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Keep me',
        duration: 0,
      })
      // Advance time so the next toast gets a different Date.now()-based id
      vi.advanceTimersByTime(1)
      useUiStore.getState().addToast({
        type: TOAST_TYPE.ERROR,
        message: 'Remove me',
        duration: 0,
      })

      const toast1 = useUiStore.getState().toasts[1]
      if (!toast1) throw new Error('Expected toast at index 1')
      const removeId = toast1.id
      useUiStore.getState().removeToast(removeId)

      expect(useUiStore.getState().toasts).toHaveLength(1)
      const toast0 = useUiStore.getState().toasts[0]
      if (!toast0) throw new Error('Expected toast at index 0')
      expect(toast0.message).toBe('Keep me')
    })

    it('should handle removing a non-existent toast id gracefully', () => {
      useUiStore.getState().addToast({
        type: TOAST_TYPE.SUCCESS,
        message: 'Existing',
        duration: 0,
      })

      useUiStore.getState().removeToast('toast_nonexistent')

      expect(useUiStore.getState().toasts).toHaveLength(1)
    })

    it('should not call clearTimeout for persistent toast (no timer)', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      useUiStore.getState().addToast({
        type: TOAST_TYPE.INFO,
        message: 'Persistent',
        duration: 0,
      })

      const toast = useUiStore.getState().toasts[0]
      if (!toast) throw new Error('Expected toast')
      const toastId = toast.id
      useUiStore.getState().removeToast(toastId)

      // clearTimeout should not be called since timer is undefined
      expect(clearTimeoutSpy).not.toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })
  })
})

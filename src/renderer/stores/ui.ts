import { create } from 'zustand'
import { type UiSettings } from '@shared/types/index.js'
import { DEFAULT_THEME_VALUE, type Theme } from '@shared/constants/theme.js'
import { DEFAULT_LANGUAGE, type SupportedLanguageLiteral } from '@shared/constants/i18n.js'
import { TIMEOUTS } from '@shared/constants/timeouts.js'
import { TOAST_TYPE, type ToastType, SORT_ORDER_NONE, STORE_KEYS } from '@shared/constants/index.js'

interface UiStore extends UiSettings {
  sidebarWidth: number
  queueDrawerOpen: boolean
  queueDrawerWidth: number
  initialized: boolean
  toasts: Toast[]
  setAppearance: (appearance: Theme) => void
  setLocale: (locale: SupportedLanguageLiteral) => void
  setSidebarWidth: (width: number) => void
  setQueueDrawerOpen: (open: boolean) => void
  setQueueDrawerWidth: (width: number) => void
  initialize: (settings: Partial<UiSettings>) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
  timer?: ReturnType<typeof setTimeout> | undefined
}

export const useUiStore = create<UiStore>((set, get) => ({
  appearance: DEFAULT_THEME_VALUE,
  locale: DEFAULT_LANGUAGE,
  connectionSortOrder: SORT_ORDER_NONE,
  sidebarWidth: 260,
  queueDrawerOpen: false,
  queueDrawerWidth: 360,
  initialized: false,
  toasts: [],

  setAppearance: appearance => {
    set({ appearance })
    const { locale, connectionSortOrder } = get()
    void window.electronAPI.config.set(STORE_KEYS.UI_SETTINGS, {
      appearance,
      locale,
      connectionSortOrder,
    })
  },

  setLocale: locale => {
    set({ locale })
    const { appearance, connectionSortOrder } = get()
    void window.electronAPI.config.set(STORE_KEYS.UI_SETTINGS, {
      appearance,
      locale,
      connectionSortOrder,
    })
  },

  setSidebarWidth: sidebarWidth => {
    set({ sidebarWidth })
  },

  setQueueDrawerOpen: queueDrawerOpen => {
    set({ queueDrawerOpen })
  },

  setQueueDrawerWidth: queueDrawerWidth => {
    set({ queueDrawerWidth })
  },

  initialize: settings => {
    set({
      ...settings,
      initialized: true,
    })
  },

  addToast: toast => {
    const id = `toast_${Date.now()}`
    let timer: ReturnType<typeof setTimeout> | undefined

    if (toast.duration !== 0) {
      const duration =
        toast.duration ??
        (toast.type === TOAST_TYPE.ERROR
          ? TIMEOUTS.TOAST_ERROR_DURATION
          : TIMEOUTS.TOAST_DEFAULT_DURATION)
      timer = setTimeout(() => {
        set(state => {
          const existingToast = state.toasts.find(t => t.id === id)
          if (!existingToast) return state
          if (existingToast.timer) {
            clearTimeout(existingToast.timer)
          }
          return {
            toasts: state.toasts.filter(t => t.id !== id),
          }
        })
      }, duration)
    }

    const newToast: Toast = { ...toast, id, timer }

    set(state => ({
      toasts: [...state.toasts, newToast],
    }))
  },

  removeToast: id => {
    set(state => {
      const toastToRemove = state.toasts.find(t => t.id === id)
      if (toastToRemove?.timer) {
        clearTimeout(toastToRemove.timer)
      }
      return {
        toasts: state.toasts.filter(t => t.id !== id),
      }
    })
  },
}))

export default useUiStore

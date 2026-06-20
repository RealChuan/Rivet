import { create } from 'zustand'
import type { UiSettings } from '@shared/types/index.js'
import {
  DEFAULT_CONNECTION_PANEL_WIDTH,
  DEFAULT_LANGUAGE,
  DEFAULT_QUEUE_DRAWER_WIDTH,
  DEFAULT_THEME_VALUE,
  DEFAULT_TRANSFER_PANEL_WIDTH,
  STORE_KEY,
  type SupportedLanguageLiteral,
  type Theme,
  TIMEOUTS,
  TOAST_TYPE,
  type ToastType,
} from '@shared/constants/index.js'
import { SIDEBAR_VIEW, type SidebarView } from '@shared/constants/transfer.js'

interface UiStore {
  appearance: Theme
  locale: SupportedLanguageLiteral | ''
  connectionPanelWidth: number
  transferPanelWidth: number
  queueDrawerOpen: boolean
  queueDrawerWidth: number
  initialized: boolean
  activeView: SidebarView
  toasts: Toast[]
  setAppearance: (appearance: Theme) => void
  setLocale: (locale: SupportedLanguageLiteral) => void
  setConnectionPanelWidth: (width: number) => void
  setTransferPanelWidth: (width: number) => void
  setActiveView: (view: SidebarView) => void
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

function getToastDuration(type: ToastType, customDuration?: number): number {
  if (customDuration !== undefined) return customDuration
  return type === TOAST_TYPE.ERROR ? TIMEOUTS.TOAST_ERROR_DURATION : TIMEOUTS.TOAST_DEFAULT_DURATION
}

export const useUiStore = create<UiStore>((set, get) => ({
  appearance: DEFAULT_THEME_VALUE,
  locale: DEFAULT_LANGUAGE,
  connectionPanelWidth: DEFAULT_CONNECTION_PANEL_WIDTH,
  transferPanelWidth: DEFAULT_TRANSFER_PANEL_WIDTH,
  queueDrawerOpen: false,
  queueDrawerWidth: DEFAULT_QUEUE_DRAWER_WIDTH,
  initialized: false,
  activeView: SIDEBAR_VIEW.CONNECTIONS,
  toasts: [],

  setAppearance: (appearance) => {
    set({ appearance })
    const { locale } = get()
    void window.electronAPI.config.set(STORE_KEY.UI_SETTINGS, {
      appearance,
      locale,
    })
  },

  setLocale: (locale) => {
    set({ locale })
    const { appearance } = get()
    void window.electronAPI.config.set(STORE_KEY.UI_SETTINGS, {
      appearance,
      locale,
    })
  },

  setConnectionPanelWidth: (connectionPanelWidth) => {
    set({ connectionPanelWidth })
  },

  setTransferPanelWidth: (transferPanelWidth) => {
    set({ transferPanelWidth })
  },

  setActiveView: (activeView) => {
    set({ activeView })
  },

  initialize: (settings) => {
    set({
      appearance: settings.appearance ?? DEFAULT_THEME_VALUE,
      locale: settings.locale ?? DEFAULT_LANGUAGE,
      activeView: SIDEBAR_VIEW.CONNECTIONS,
      initialized: true,
    })
  },

  addToast: (toast) => {
    const id = crypto.randomUUID()
    let timer: ReturnType<typeof setTimeout> | undefined

    if (toast.duration !== 0) {
      const duration = getToastDuration(toast.type, toast.duration)
      timer = setTimeout(() => {
        set((state) => {
          const existingToast = state.toasts.find((t) => t.id === id)
          if (!existingToast) return state
          if (existingToast.timer) {
            clearTimeout(existingToast.timer)
          }
          return {
            toasts: state.toasts.filter((t) => t.id !== id),
          }
        })
      }, duration)
    }

    const newToast: Toast = { ...toast, id, timer }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))
  },

  removeToast: (id) => {
    set((state) => {
      const toastToRemove = state.toasts.find((t) => t.id === id)
      if (toastToRemove?.timer) {
        clearTimeout(toastToRemove.timer)
      }
      return {
        toasts: state.toasts.filter((t) => t.id !== id),
      }
    })
  },
}))

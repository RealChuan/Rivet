import { create } from 'zustand'
import { type UiSettings } from '@shared/types/index.js'

interface UiStore extends UiSettings {
  sidebarWidth: number
  queueDrawerOpen: boolean
  queueDrawerWidth: number
  initialized: boolean
  toasts: Toast[]
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setLanguage: (language: 'zh-CN' | 'en-US') => void
  setSidebarWidth: (width: number) => void
  setQueueDrawerOpen: (open: boolean) => void
  setQueueDrawerWidth: (width: number) => void
  initialize: (settings: Partial<UiSettings>) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  duration?: number
}

export const useUiStore = create<UiStore>((set, get) => ({
  theme: 'system',
  language: 'en-US',
  sidebarWidth: 260,
  queueDrawerOpen: false,
  queueDrawerWidth: 360,
  initialized: false,
  toasts: [],

  setTheme: theme => {
    set({ theme })
    const { language } = get()
    void window.electronAPI.common.storeSet('ui_settings', {
      theme,
      language,
    })
  },

  setLanguage: language => {
    set({ language })
    const { theme } = get()
    void window.electronAPI.common.storeSet('ui_settings', {
      theme,
      language,
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
    const newToast = { ...toast, id }
    set(state => ({
      toasts: [...state.toasts, newToast],
    }))

    if (toast.duration !== 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, toast.duration ?? 3000)
    }
  },

  removeToast: id => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }))
  },
}))

export default useUiStore

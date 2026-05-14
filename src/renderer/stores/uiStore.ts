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
  timer?: ReturnType<typeof setTimeout> | undefined
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
    let timer: ReturnType<typeof setTimeout> | undefined

    if (toast.duration !== 0) {
      const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 3000)
      timer = setTimeout(() => {
        get().removeToast(id)
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

import { unwrap } from './result.js'

type AppEventApi = typeof window.electronAPI.app

export const appApi = {
  confirmClose: async (): Promise<void> => {
    unwrap(await window.electronAPI.app.confirmClose())
  },

  setTheme: (theme: 'light' | 'dark' | 'system'): void => {
    window.electronAPI.app.setTheme(theme)
  },

  onCloseRequested: (callback: Parameters<AppEventApi['onCloseRequested']>[0]) =>
    window.electronAPI.app.onCloseRequested(callback),
}

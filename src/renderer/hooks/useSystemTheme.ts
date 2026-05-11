import { useEffect } from 'react'
import { useUiStore } from '../stores/index.js'

export const useSystemTheme = () => {
  const { initialized } = useUiStore()

  useEffect(() => {
    if (!initialized) return

    const handleSystemThemeChange = () => {
      const uiSettings = useUiStore.getState()
      if (uiSettings.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
      }
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [initialized])
}

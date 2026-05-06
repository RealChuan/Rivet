import { useEffect, useCallback } from 'react'
import { useUiStore } from '../stores/uiStore'

export function useTheme() {
  const { theme, setTheme } = useUiStore()

  const applyTheme = useCallback((resolvedTheme: 'light' | 'dark') => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [])

  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  const resolveTheme = useCallback((): 'light' | 'dark' => {
    if (theme === 'system') {
      return getSystemTheme()
    }
    return theme
  }, [theme, getSystemTheme])

  useEffect(() => {
    const resolvedTheme = resolveTheme()
    applyTheme(resolvedTheme)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        applyTheme(getSystemTheme())
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, resolveTheme, applyTheme, getSystemTheme])

  const cycleTheme = useCallback(() => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }, [theme, setTheme])

  return {
    theme,
    resolvedTheme: resolveTheme(),
    setTheme,
    cycleTheme,
  }
}

export default useTheme

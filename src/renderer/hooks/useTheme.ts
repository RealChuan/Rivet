import { useEffect, useCallback, useSyncExternalStore } from 'react'
import {
  LIGHT,
  DARK,
  SYSTEM,
  THEME_ORDER,
  type ResolvedTheme,
  type Theme,
} from '@shared/constants/theme.js'
import { useUiStore } from '../stores/index.js'

function subscribeSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT
}

export function useTheme() {
  const { theme, setTheme } = useUiStore()

  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    () => LIGHT
  )

  const resolvedTheme = theme === SYSTEM ? systemTheme : theme

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === DARK) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    root.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  const cycleTheme = useCallback(() => {
    const currentTheme: Theme = theme ?? SYSTEM
    const currentIndex = THEME_ORDER.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length
    const nextTheme = THEME_ORDER[nextIndex] ?? SYSTEM
    setTheme(nextTheme)
  }, [theme, setTheme])

  return {
    theme,
    resolvedTheme,
    setTheme,
    cycleTheme,
  }
}

export default useTheme

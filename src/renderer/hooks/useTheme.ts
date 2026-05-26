import { useEffect, useSyncExternalStore } from 'react'
import {
  THEME_LIGHT,
  THEME_DARK,
  THEME_SYSTEM,
  THEME_VALUES,
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
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT
}

export function useApplicationTheme() {
  const appearance = useUiStore(state => state.appearance)
  const setAppearance = useUiStore(state => state.setAppearance)

  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    () => THEME_LIGHT
  )

  const resolvedTheme = appearance === THEME_SYSTEM ? systemTheme : appearance

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === THEME_DARK) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    root.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  const cycleTheme = () => {
    const currentTheme: Theme = appearance ?? THEME_SYSTEM
    const currentIndex = THEME_VALUES.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % THEME_VALUES.length
    const nextTheme = THEME_VALUES[nextIndex] ?? THEME_SYSTEM
    setAppearance(nextTheme)
  }

  return {
    theme: appearance,
    resolvedTheme,
    setTheme: setAppearance,
    cycleTheme,
  }
}

export default useApplicationTheme

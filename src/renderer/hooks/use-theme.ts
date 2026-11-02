import { useEffect, useSyncExternalStore } from 'react'
import { type ResolvedTheme, THEME, type Theme, THEME_VALUES } from '@shared/constants/index.js'
import { appApi } from '../api/app.js'
import { systemApi } from '../api/system.js'
import { useUiStore } from '../stores/index.js'

function subscribeSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME.DARK : THEME.LIGHT
}

export function useApplicationTheme() {
  const appearance = useUiStore((state) => state.appearance)
  const setAppearance = useUiStore((state) => state.setAppearance)

  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    () => THEME.LIGHT,
  )

  const resolvedTheme = appearance === THEME.SYSTEM ? systemTheme : appearance

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === THEME.DARK) {
      root.classList.add(THEME.DARK)
    } else {
      root.classList.remove(THEME.DARK)
    }
    root.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    appApi.setTheme(appearance)
  }, [appearance])

  // 无窗口级材质时，主界面改用不透明底色
  useEffect(() => {
    void systemApi.supportsGlass().then((supported) => {
      document.documentElement.classList.toggle('no-glass', !supported)
    })
  }, [])

  const cycleTheme = () => {
    const currentTheme: Theme = appearance ?? THEME.SYSTEM
    const currentIndex = THEME_VALUES.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % THEME_VALUES.length
    const nextTheme = THEME_VALUES[nextIndex] ?? THEME.SYSTEM
    setAppearance(nextTheme)
  }

  return {
    theme: appearance,
    resolvedTheme,
    setTheme: (theme: Theme) => setAppearance(theme),
    cycleTheme,
  }
}

export default useApplicationTheme

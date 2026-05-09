import { useEffect, useCallback, useSyncExternalStore } from 'react'
import { useUiStore } from '../stores/uiStore.js'

// 系统主题监听（稳定引用，避免重复订阅）
function subscribeSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getSystemThemeSnapshot(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const { theme, setTheme } = useUiStore()

  // 实时同步系统主题（无论当前是否 system 模式，都保持最新）
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    () => 'light' // SSR fallback
  )

  // 解析最终主题
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  // 应用到 DOM
  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // 可选：同时设置 data-theme 供 CSS 变量使用
    root.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  // 循环切换
  const cycleTheme = useCallback(() => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const nextIndex = (themes.indexOf(theme) + 1) % themes.length
    setTheme(themes[nextIndex])
  }, [theme, setTheme])

  return {
    theme, // 当前设置：light | dark | system
    resolvedTheme, // 实际生效：light | dark
    setTheme,
    cycleTheme,
  }
}

export default useTheme

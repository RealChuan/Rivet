import type { ITheme } from '@xterm/xterm'
import { useEffect, useState } from 'react'
import {
  resolveThemeMode,
  terminalThemeOf,
  type TerminalThemeMode,
} from '../utils/terminal-theme.js'

/**
 * 跟随应用主题：`appearance` 可能为「跟随系统」，因此直接观察根节点的 `data-theme`，
 * 任何来源的切换都能收到。
 */
export function useTerminalTheme(): ITheme {
  const [mode, setMode] = useState<TerminalThemeMode>(() =>
    resolveThemeMode(document.documentElement),
  )

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setMode(resolveThemeMode(root))
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => observer.disconnect()
  }, [])

  return terminalThemeOf(mode)
}

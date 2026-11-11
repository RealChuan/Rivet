import type { ITheme } from '@xterm/xterm'

export type TerminalThemeMode = 'light' | 'dark'

/**
 * 终端有独立的 16 色 ANSI 调色板，无法从 Tailwind 令牌派生，按 `data-theme` 维护两份。
 * 色相沿用应用既有色（accent、status、协议色），避免纯黑终端与界面脱节。
 * 滚动条滑块取各主题 text-muted 的 30%、hover 50%，与全局滚动条一致。
 */
const LIGHT: ITheme = {
  // 8 位十六进制的全透明：xterm 只认这种写法，rgba() 会被当成黑色。
  background: '#00000000',
  foreground: '#171717',
  cursor: '#2563eb',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(37, 99, 235, 0.18)',
  scrollbarSliderBackground: '#7373734d',
  scrollbarSliderHoverBackground: '#73737380',
  scrollbarSliderActiveBackground: '#73737380',
  black: '#3f3f46',
  red: '#dc2626',
  green: '#15803d',
  yellow: '#a16207',
  blue: '#2563eb',
  magenta: '#7c3aed',
  cyan: '#0e7490',
  white: '#a1a1aa',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#16a34a',
  brightYellow: '#ca8a04',
  brightBlue: '#3b82f6',
  brightMagenta: '#8b5cf6',
  brightCyan: '#0891b2',
  brightWhite: '#18181b',
}

const DARK: ITheme = {
  background: '#00000000',
  foreground: '#e5e5e5',
  cursor: '#4d94f5',
  cursorAccent: '#1b1b1c',
  selectionBackground: 'rgba(96, 165, 250, 0.28)',
  scrollbarSliderBackground: '#a3a3a34d',
  scrollbarSliderHoverBackground: '#a3a3a380',
  scrollbarSliderActiveBackground: '#a3a3a380',
  black: '#3f3f46',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#4d94f5',
  magenta: '#a78bfa',
  cyan: '#38bdf8',
  white: '#d4d4d8',
  brightBlack: '#71717a',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#c4b5fd',
  brightCyan: '#7dd3fc',
  brightWhite: '#fafafa',
}

/** 与 `--font-mono` 保持一致：Geist Mono 是应用唯一的等宽字体。 */
export const TERMINAL_FONT_FAMILY = "'Geist Mono Variable', 'SF Mono', 'Fira Code', monospace"

/** 主题由 `useApplicationTheme` 写到根节点，这里只读结果。 */
export function resolveThemeMode(root: HTMLElement): TerminalThemeMode {
  return root.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function terminalThemeOf(mode: TerminalThemeMode): ITheme {
  return mode === 'dark' ? DARK : LIGHT
}

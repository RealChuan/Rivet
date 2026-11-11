import { describe, expect, it } from 'vitest'
import { resolveThemeMode, terminalThemeOf } from './terminal-theme.js'

describe('terminal theme', () => {
  it('根节点的 data-theme 决定用哪份配色', () => {
    const root = document.createElement('div')
    root.dataset.theme = 'dark'
    expect(resolveThemeMode(root)).toBe('dark')

    root.dataset.theme = 'light'
    expect(resolveThemeMode(root)).toBe('light')
  })

  it('没写 data-theme 时按浅色处理', () => {
    expect(resolveThemeMode(document.createElement('div'))).toBe('light')
  })

  it('两份配色都给出完整的 16 色与背景/前景', () => {
    const keys = [
      'black',
      'red',
      'green',
      'yellow',
      'blue',
      'magenta',
      'cyan',
      'white',
      'brightBlack',
      'brightRed',
      'brightGreen',
      'brightYellow',
      'brightBlue',
      'brightMagenta',
      'brightCyan',
      'brightWhite',
    ] as const

    for (const mode of ['light', 'dark'] as const) {
      const theme = terminalThemeOf(mode)
      expect(theme.foreground).toBeTruthy()
      for (const key of keys) {
        expect(theme[key]).toBeTruthy()
      }
    }
  })

  it('背景透明，交给面板底色，不额外制造一块表面', () => {
    expect(terminalThemeOf('light').background).toBe('#00000000')
    expect(terminalThemeOf('dark').background).toBe('#00000000')
  })
})

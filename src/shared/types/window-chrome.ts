export const WINDOW_CHROME_MODES = ['wco', 'mac-hidden', 'custom'] as const

export type WindowChromeMode = (typeof WINDOW_CHROME_MODES)[number]

export function isWindowChromeMode(value: unknown): value is WindowChromeMode {
  return typeof value === 'string' && WINDOW_CHROME_MODES.includes(value as WindowChromeMode)
}

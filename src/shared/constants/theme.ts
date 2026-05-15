export const LIGHT = 'light' as const
export const DARK = 'dark' as const
export const SYSTEM = 'system' as const

export type Theme = typeof LIGHT | typeof DARK | typeof SYSTEM
export type ResolvedTheme = typeof LIGHT | typeof DARK

export const DEFAULT_THEME = SYSTEM
export const THEME_ORDER: Theme[] = [LIGHT, DARK, SYSTEM]

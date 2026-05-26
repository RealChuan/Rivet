export const THEME_LIGHT = 'light' as const
export const THEME_DARK = 'dark' as const
export const THEME_SYSTEM = 'system' as const

export type Theme = typeof THEME_LIGHT | typeof THEME_DARK | typeof THEME_SYSTEM
export type ResolvedTheme = typeof THEME_LIGHT | typeof THEME_DARK

export const DEFAULT_THEME_VALUE = THEME_SYSTEM
export const THEME_VALUES: Theme[] = [THEME_LIGHT, THEME_DARK, THEME_SYSTEM]

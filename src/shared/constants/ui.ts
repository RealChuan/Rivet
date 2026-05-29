export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const

export type Theme = (typeof THEME)[keyof typeof THEME]
export type ResolvedTheme = typeof THEME.LIGHT | typeof THEME.DARK

export const DEFAULT_THEME_VALUE = THEME.SYSTEM
export const THEME_VALUES: Theme[] = [THEME.LIGHT, THEME.DARK, THEME.SYSTEM]

export const TOAST_TYPE = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
} as const

export type ToastType = (typeof TOAST_TYPE)[keyof typeof TOAST_TYPE]

export const VIEW_MODE = {
  LIST: 'list',
  GRID: 'grid',
} as const

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE]

export const FILE_TYPE = {
  FILE: 'file',
  DIRECTORY: 'directory',
} as const

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE]

export const HOST_KEY_DIALOG_TYPE = {
  FIRST_CONNECT: 'first-connect',
  MISMATCH: 'mismatch',
} as const

export type HostKeyDialogType = (typeof HOST_KEY_DIALOG_TYPE)[keyof typeof HOST_KEY_DIALOG_TYPE]

export const ERROR_CODES = {
  CONFIG_ERROR: 'CONFIG_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

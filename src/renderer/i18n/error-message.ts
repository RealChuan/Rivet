import type { TFunction } from 'i18next'
import { isErrorCode, type ErrorCode } from '@shared/domain/error.js'
import { ApiError } from '../api/result.js'

type ErrorSelector = (t: TFunction) => string

const SELECTORS: Partial<Record<ErrorCode, ErrorSelector>> = {
  AUTH_ERROR: (t) => t(($) => $.errors.AUTH_ERROR),
  CONN_FAILED: (t) => t(($) => $.errors.CONN_FAILED),
  CONN_NOT_FOUND: (t) => t(($) => $.errors.CONN_NOT_FOUND),
  HOST_KEY_ERROR: (t) => t(($) => $.errors.HOST_KEY_ERROR),
  HOST_KEY_UNKNOWN: (t) => t(($) => $.errors.HOST_KEY_UNKNOWN),
  HOST_KEY_MISMATCH: (t) => t(($) => $.errors.HOST_KEY_MISMATCH),
  KEY_FILE_UNREADABLE: (t) => t(($) => $.errors.KEY_FILE_UNREADABLE),
  KEY_PARSE_FAILED: (t) => t(($) => $.errors.KEY_PARSE_FAILED),
  PASSPHRASE_REQUIRED: (t) => t(($) => $.errors.PASSPHRASE_REQUIRED),
  AGENT_NO_IDENTITY: (t) => t(($) => $.errors.AGENT_NO_IDENTITY),
  AGENT_NOT_AVAILABLE: (t) => t(($) => $.errors.AGENT_NOT_AVAILABLE),
  PERMISSION_DENIED: (t) => t(($) => $.errors.PERMISSION_DENIED),
  NOT_FOUND: (t) => t(($) => $.errors.NOT_FOUND),
  ALREADY_EXISTS: (t) => t(($) => $.errors.ALREADY_EXISTS),
  NOT_SUPPORTED: (t) => t(($) => $.errors.NOT_SUPPORTED),
  LIST_FAILED: (t) => t(($) => $.errors.LIST_FAILED),
  LIST_TIMEOUT: (t) => t(($) => $.errors.LIST_TIMEOUT),
  MKDIR_ERROR: (t) => t(($) => $.errors.MKDIR_ERROR),
  RENAME_ERROR: (t) => t(($) => $.errors.RENAME_ERROR),
  DELETE_ERROR: (t) => t(($) => $.errors.DELETE_ERROR),
  COPY_ERROR: (t) => t(($) => $.errors.COPY_ERROR),
  MOVE_ERROR: (t) => t(($) => $.errors.MOVE_ERROR),
  UPLOAD_ERROR: (t) => t(($) => $.errors.UPLOAD_ERROR),
  DOWNLOAD_ERROR: (t) => t(($) => $.errors.DOWNLOAD_ERROR),
  REQUEST_TIMEOUT: (t) => t(($) => $.errors.REQUEST_TIMEOUT),
  REQUEST_ABORTED: (t) => t(($) => $.errors.REQUEST_ABORTED),
  CONFIG_ERROR: (t) => t(($) => $.errors.CONFIG_ERROR),
  INVALID_CONFIG: (t) => t(($) => $.errors.INVALID_CONFIG),
  DECRYPT_FORMAT_ERROR: (t) => t(($) => $.errors.DECRYPT_FORMAT_ERROR),
  DECRYPT_UNAVAILABLE: (t) => t(($) => $.errors.DECRYPT_UNAVAILABLE),
  DECRYPTION_ERROR: (t) => t(($) => $.errors.DECRYPTION_ERROR),
  PATH_TRAVERSAL: (t) => t(($) => $.errors.PATH_TRAVERSAL),
  PATH_ERROR: (t) => t(($) => $.errors.PATH_ERROR),
  INVALID_STATE: (t) => t(($) => $.errors.INVALID_STATE),
  SELF_CONTAINED: (t) => t(($) => $.errors.SELF_CONTAINED),
}

const KEY_BY_CODE: Partial<Record<ErrorCode, string>> = {
  AUTH_ERROR: 'errors.AUTH_ERROR',
  CONN_FAILED: 'errors.CONN_FAILED',
  CONN_NOT_FOUND: 'errors.CONN_NOT_FOUND',
  HOST_KEY_ERROR: 'errors.HOST_KEY_ERROR',
  HOST_KEY_UNKNOWN: 'errors.HOST_KEY_UNKNOWN',
  HOST_KEY_MISMATCH: 'errors.HOST_KEY_MISMATCH',
  KEY_FILE_UNREADABLE: 'errors.KEY_FILE_UNREADABLE',
  KEY_PARSE_FAILED: 'errors.KEY_PARSE_FAILED',
  PASSPHRASE_REQUIRED: 'errors.PASSPHRASE_REQUIRED',
  AGENT_NO_IDENTITY: 'errors.AGENT_NO_IDENTITY',
  AGENT_NOT_AVAILABLE: 'errors.AGENT_NOT_AVAILABLE',
  PERMISSION_DENIED: 'errors.PERMISSION_DENIED',
  NOT_FOUND: 'errors.NOT_FOUND',
  ALREADY_EXISTS: 'errors.ALREADY_EXISTS',
  NOT_SUPPORTED: 'errors.NOT_SUPPORTED',
  LIST_FAILED: 'errors.LIST_FAILED',
  LIST_TIMEOUT: 'errors.LIST_TIMEOUT',
  MKDIR_ERROR: 'errors.MKDIR_ERROR',
  RENAME_ERROR: 'errors.RENAME_ERROR',
  DELETE_ERROR: 'errors.DELETE_ERROR',
  COPY_ERROR: 'errors.COPY_ERROR',
  MOVE_ERROR: 'errors.MOVE_ERROR',
  UPLOAD_ERROR: 'errors.UPLOAD_ERROR',
  DOWNLOAD_ERROR: 'errors.DOWNLOAD_ERROR',
  REQUEST_TIMEOUT: 'errors.REQUEST_TIMEOUT',
  REQUEST_ABORTED: 'errors.REQUEST_ABORTED',
  CONFIG_ERROR: 'errors.CONFIG_ERROR',
  INVALID_CONFIG: 'errors.INVALID_CONFIG',
  DECRYPT_FORMAT_ERROR: 'errors.DECRYPT_FORMAT_ERROR',
  DECRYPT_UNAVAILABLE: 'errors.DECRYPT_UNAVAILABLE',
  DECRYPTION_ERROR: 'errors.DECRYPTION_ERROR',
  PATH_TRAVERSAL: 'errors.PATH_TRAVERSAL',
  PATH_ERROR: 'errors.PATH_ERROR',
  INVALID_STATE: 'errors.INVALID_STATE',
  SELF_CONTAINED: 'errors.SELF_CONTAINED',
}

export function errorMessageKey(code: ErrorCode): string {
  return KEY_BY_CODE[code] ?? 'errors.UNKNOWN'
}

function readServerMessage(detail: unknown): string | undefined {
  if (typeof detail !== 'object' || detail === null) return undefined
  const value = (detail as Record<string, unknown>).serverMessage
  if (typeof value !== 'string') return undefined

  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : undefined
}

function serverMessageOf(error: unknown): string | undefined {
  if (error instanceof ApiError) return readServerMessage(error.appError.detail)
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    return readServerMessage(error.detail)
  }
  return undefined
}

function errorCodeOf(error: unknown): ErrorCode | undefined {
  if (error instanceof ApiError) return error.code
  if (typeof error === 'object' && error !== null && 'code' in error && isErrorCode(error.code)) {
    return error.code
  }
  return undefined
}

export function resolveErrorMessage(t: TFunction, error: unknown): string {
  const code = errorCodeOf(error)
  if (code === undefined) return t(($) => $.errors.UNKNOWN)

  const base = (SELECTORS[code] ?? ((translate) => translate(($) => $.errors.UNKNOWN)))(t)
  const serverMessage = serverMessageOf(error)
  return serverMessage ? `${base}: ${serverMessage}` : base
}

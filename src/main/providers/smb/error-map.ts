import type { ErrorCode } from '@shared/domain/error.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'

const STATUS_MAP: Readonly<Record<string, ErrorCode>> = {
  STATUS_OBJECT_NAME_NOT_FOUND: ERROR_CODE.NOT_FOUND,
  STATUS_OBJECT_PATH_NOT_FOUND: ERROR_CODE.NOT_FOUND,
  STATUS_NO_SUCH_FILE: ERROR_CODE.NOT_FOUND,
  STATUS_OBJECT_NAME_COLLISION: ERROR_CODE.ALREADY_EXISTS,
  STATUS_ACCESS_DENIED: ERROR_CODE.PERMISSION_DENIED,
  STATUS_PRIVILEGE_NOT_HELD: ERROR_CODE.PERMISSION_DENIED,
  STATUS_DELETE_PENDING: ERROR_CODE.PERMISSION_DENIED,
  STATUS_LOGON_FAILURE: ERROR_CODE.AUTH_ERROR,
  STATUS_ACCOUNT_DISABLED: ERROR_CODE.AUTH_ERROR,
  STATUS_ACCOUNT_LOCKED_OUT: ERROR_CODE.AUTH_ERROR,
  STATUS_PASSWORD_EXPIRED: ERROR_CODE.AUTH_ERROR,
  STATUS_INVALID_LOGON_HOURS: ERROR_CODE.AUTH_ERROR,
  STATUS_INVALID_WORKSTATION: ERROR_CODE.AUTH_ERROR,
  STATUS_NOT_SUPPORTED: ERROR_CODE.NOT_SUPPORTED,
  STATUS_INVALID_PARAMETER: ERROR_CODE.INVALID_CONFIG,
  STATUS_NETWORK_NAME_DELETED: ERROR_CODE.CONN_FAILED,
  STATUS_CONNECTION_DISCONNECTED: ERROR_CODE.CONN_FAILED,
  STATUS_CONNECTION_RESET: ERROR_CODE.CONN_FAILED,
  STATUS_NETWORK_UNREACHABLE: ERROR_CODE.CONN_FAILED,
  STATUS_HOST_UNREACHABLE: ERROR_CODE.CONN_FAILED,
  STATUS_IO_TIMEOUT: ERROR_CODE.REQUEST_TIMEOUT,
  ECONNREFUSED: ERROR_CODE.CONN_FAILED,
  ECONNRESET: ERROR_CODE.CONN_FAILED,
  EHOSTUNREACH: ERROR_CODE.CONN_FAILED,
  ENETUNREACH: ERROR_CODE.CONN_FAILED,
  ETIMEDOUT: ERROR_CODE.CONN_FAILED,
  EPIPE: ERROR_CODE.CONN_FAILED,
  EACCES: ERROR_CODE.PERMISSION_DENIED,
  ENOENT: ERROR_CODE.NOT_FOUND,
  EEXIST: ERROR_CODE.ALREADY_EXISTS,
}

function errorCodeOf(error: unknown): string | undefined {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return undefined
}

/**
 * 把 v9u-smb2 的 NTSTATUS / Node 错误收敛成领域错误。
 * 未识别的状态保留原始 message，由上层按 fallback 翻译。
 */
export function toProviderError(error: unknown, fallback: ErrorCode): ProviderError {
  if (error instanceof ProviderError) return error

  const status = errorCodeOf(error)
  const code = status !== undefined ? (STATUS_MAP[status] ?? fallback) : fallback
  const message = error instanceof Error ? error.message : String(error)
  const detail = status !== undefined ? { status } : undefined

  return new ProviderError(code, message, detail)
}

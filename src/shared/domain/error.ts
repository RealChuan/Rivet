import { z } from 'zod'
import { ERROR_CODE } from '../constants/error-code.js'

/**
 * 全仓唯一的错误码联合类型。
 * 取值来自 `ERROR_CODE`，新增错误码只需在那里加一项。
 */
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

const VALID_CODES: ReadonlySet<string> = new Set(Object.values(ERROR_CODE))

/**
 * 跨进程错误的唯一形状。
 * `message` 只用于日志与调试，用户可见文案由渲染层按 `code` 翻译。
 */
export interface AppError {
  code: ErrorCode
  message: string
  detail?: Record<string, unknown> | undefined
  stack?: string | undefined
}

/** 兼容旧命名；P3 之后统一用 `AppError`。 */
export type ErrorInfo = AppError

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && VALID_CODES.has(value)
}

/** 直接构造带结构化 detail 的 AppError（detail 必须可结构化克隆）。 */
export function createAppError(
  code: ErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): AppError {
  return { code, message, ...(detail ? { detail } : {}) }
}

/** 契约层用来描述错误形状；非法错误码在校验阶段即被拒绝。 */
export const appErrorSchema = z.object({
  code: z.custom<ErrorCode>(isErrorCode),
  message: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
  stack: z.string().optional(),
})

/**
 * 创建结构化错误。字符串形式的 detail 会被包成 `{ reason }`，
 * 保证 `detail` 始终是对象、可跨 IPC 传输。
 */
export function createErrorInfo(
  code: ErrorCode,
  message: string,
  detail?: string,
  stack?: string,
): AppError {
  return {
    code,
    message,
    ...(detail !== undefined ? { detail: { reason: detail } } : {}),
    ...(stack !== undefined ? { stack } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 只保留可结构化克隆的纯数据：丢掉函数、原型与循环引用。
 * 无法序列化时整体丢弃 detail，而不是抛错。
 */
function sanitizeDetail(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined
  try {
    const json = JSON.stringify(value)
    if (json === undefined) return undefined
    const parsed: unknown = JSON.parse(json)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * 把任意抛出物归一为 `AppError`。
 * 用于 IPC 边界、worker 回调等拿不到类型化错误的地方。
 */
function hasCode(value: object): value is object & { code: unknown } {
  return 'code' in value
}

export function toAppError(cause: unknown, fallback: ErrorCode): AppError {
  if (cause instanceof Error) {
    const code = hasCode(cause) && isErrorCode(cause.code) ? cause.code : fallback
    const detail =
      'detail' in cause && isRecord(cause.detail) ? sanitizeDetail(cause.detail) : undefined
    return { code, message: cause.message, ...(detail !== undefined ? { detail } : {}) }
  }

  if (isRecord(cause)) {
    const code = isErrorCode(cause.code) ? cause.code : fallback
    const message = typeof cause.message === 'string' ? cause.message : undefined
    const detail = sanitizeDetail(cause.detail)
    return {
      code,
      ...(message !== undefined ? { message } : { message: code }),
      ...(detail !== undefined ? { detail } : {}),
    }
  }

  if (typeof cause === 'string') {
    return { code: fallback, message: cause }
  }

  return { code: fallback, message: fallback }
}

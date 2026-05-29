import {
  createErrorInfo,
  err,
  type ErrorInfo,
  isErr,
  ok,
  type Result,
  tryCatchAsync,
} from '../types/result.js'

export async function handleIpcResultAsync<T>(
  operation: string,
  handler: () => Promise<T>
): Promise<Result<T, ErrorInfo>> {
  const result = await tryCatchAsync(handler)

  if (isErr(result)) {
    const error = result.error
    const errorInfo = createErrorInfo(
      'IPC_ERROR',
      `${operation} failed`,
      error instanceof Error ? error.message : String(error)
    )
    return err(errorInfo)
  }

  return ok(result.value)
}

export function handleIpcResult<T>(operation: string, handler: () => T): Result<T, ErrorInfo> {
  try {
    const value = handler()
    return ok(value)
  } catch (error) {
    const errorInfo = createErrorInfo(
      'IPC_ERROR',
      `${operation} failed`,
      error instanceof Error ? error.message : String(error)
    )
    return err(errorInfo)
  }
}

export function toIpcResult<T>(
  value: T | null | undefined,
  errorMessage: string
): Result<T, ErrorInfo> {
  if (value === null || value === undefined) {
    return err(createErrorInfo('IPC_NULL', errorMessage))
  }
  return ok(value)
}

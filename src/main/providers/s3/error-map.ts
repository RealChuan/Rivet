import type { ErrorCode } from '@shared/domain/error.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'

/** SDK 错误里我们需要的字段；不引入 `any`，用结构描述。 */
interface S3ErrorShape {
  readonly name?: string
  readonly Code?: string
  readonly message?: string
  readonly $metadata?: { readonly httpStatusCode?: number }
}

function asS3Error(error: unknown): S3ErrorShape {
  if (typeof error !== 'object' || error === null) return {}
  return error
}

/** S3 的 `<Error><Code>` 与 SDK 的 `name` 都是字符串，统一查这张表。 */
const ERROR_CODE_BY_NAME = new Map<string, ErrorCode>([
  ['NoSuchKey', ERROR_CODE.NOT_FOUND],
  ['NoSuchBucket', ERROR_CODE.NOT_FOUND],
  ['NotFound', ERROR_CODE.NOT_FOUND],
  ['AccessDenied', ERROR_CODE.PERMISSION_DENIED],
  ['AllAccessDisabled', ERROR_CODE.PERMISSION_DENIED],
  ['InvalidAccessKeyId', ERROR_CODE.AUTH_ERROR],
  ['SignatureDoesNotMatch', ERROR_CODE.AUTH_ERROR],
  ['InvalidToken', ERROR_CODE.AUTH_ERROR],
  ['ExpiredToken', ERROR_CODE.AUTH_ERROR],
  ['PreconditionFailed', ERROR_CODE.ALREADY_EXISTS],
  ['InvalidBucketName', ERROR_CODE.INVALID_CONFIG],
  ['InvalidRequest', ERROR_CODE.INVALID_CONFIG],
  ['RequestTimeTooSkewed', ERROR_CODE.CONN_FAILED],
  ['PermanentRedirect', ERROR_CODE.CONN_FAILED],
])

function codeFromStatus(status: number | undefined): ErrorCode | undefined {
  switch (status) {
    case 400:
      return ERROR_CODE.INVALID_CONFIG
    case 401:
      return ERROR_CODE.AUTH_ERROR
    case 403:
      return ERROR_CODE.PERMISSION_DENIED
    case 404:
      return ERROR_CODE.NOT_FOUND
    case 412:
      return ERROR_CODE.ALREADY_EXISTS
    default:
      return undefined
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function serverMessageOf(error: unknown, shape: S3ErrorShape): string | undefined {
  const code = shape.Code ?? shape.name
  const message = error instanceof Error ? error.message : shape.message
  if (code === undefined && message === undefined) return undefined
  return [code, message].filter((part) => part !== undefined && part !== '').join(': ')
}

/**
 * 统一把 SDK 错误折叠成 `ProviderError`。
 * 错误码优先按 S3 的 Code 判定，其次退回 HTTP 状态码；正文只放进 `detail.serverMessage`。
 */
export function toS3ProviderError(error: unknown, action: string): ProviderError {
  if (error instanceof ProviderError) return error
  if (isAbortError(error)) {
    return new ProviderError(ERROR_CODE.REQUEST_ABORTED, `S3 ${action} aborted`)
  }

  const shape = asS3Error(error)
  const name = shape.Code ?? shape.name
  const mapped =
    (name === undefined ? undefined : ERROR_CODE_BY_NAME.get(name)) ??
    codeFromStatus(shape.$metadata?.httpStatusCode)
  const code = mapped ?? ERROR_CODE.CONN_FAILED
  const serverMessage = serverMessageOf(error, shape)

  return new ProviderError(
    code,
    `S3 ${action} failed with ${code}${serverMessage === undefined ? '' : `: ${serverMessage}`}`,
    serverMessage === undefined ? undefined : { serverMessage },
  )
}

import { type ErrorInfo } from './result.js'

type RequestId = string

interface ProtocolSuccessResponse<T> {
  requestId: RequestId
  success: true
  value: T
  error: undefined
}

interface ProtocolErrorResponse {
  requestId: RequestId
  success: false
  value: undefined
  error: ErrorInfo
}

export type ProtocolResponse<T> = ProtocolSuccessResponse<T> | ProtocolErrorResponse

export const isProtocolResponseErr = <T>(
  response: ProtocolResponse<T>,
): response is ProtocolErrorResponse => {
  return !response.success
}

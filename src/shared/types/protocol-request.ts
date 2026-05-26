import { type ErrorInfo } from './result.js'

export type RequestId = string

export interface ProtocolSuccessResponse<T> {
  requestId: RequestId
  success: true
  value: T
  error: undefined
}

export interface ProtocolErrorResponse {
  requestId: RequestId
  success: false
  value: undefined
  error: ErrorInfo
}

export type ProtocolResponse<T> = ProtocolSuccessResponse<T> | ProtocolErrorResponse

export const isProtocolResponseErr = <T>(
  response: ProtocolResponse<T>
): response is ProtocolErrorResponse => {
  return !response.success
}

export const isProtocolResponseOk = <T>(
  response: ProtocolResponse<T>
): response is ProtocolSuccessResponse<T> => {
  return response.success
}

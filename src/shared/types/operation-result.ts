import type { StatusCode } from '../constants/protocol-status.js'

export interface SftpConnectDetail {
  fingerprint: string
  previousFingerprint?: string
}

export interface OperationResult {
  sessionId: string
  statusCode: StatusCode
  detail: SftpConnectDetail
}

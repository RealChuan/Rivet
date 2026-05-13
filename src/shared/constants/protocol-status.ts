export const ProtocolStatus = {
  OK: 2000,
  FIRST_CONNECT: 2001,
} as const

export const SftpStatus = {
  HOST_KEY_MISMATCH: 3000,
} as const

export const InternalStatus = {
  STORE_ERROR: 5000,
} as const

export const StatusCodeEnum = {
  ...ProtocolStatus,
  ...SftpStatus,
  ...InternalStatus,
} as const

export type StatusCode = (typeof StatusCodeEnum)[keyof typeof StatusCodeEnum]

export function getStatusMessage(code: StatusCode): string {
  const messages: Record<number, string> = {
    2000: 'connection.ok',
    2001: 'connection.firstConnect',
    3000: 'connection.hostKeyMismatch',
    5000: 'connection.storeError',
  }
  return messages[code] ?? `Unknown status: ${code}`
}

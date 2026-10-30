/** WebDAV provider 里参与分支判断的状态码。 */
export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
} as const

const SUCCESS_RANGE_START = 200
const SUCCESS_RANGE_END = 300

const STATUS_LINE_PATTERN = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/

export function isHttpSuccess(status: number): boolean {
  return status >= SUCCESS_RANGE_START && status < SUCCESS_RANGE_END
}

/** DAV 的 `status` 是状态行文本（`HTTP/1.1 207 Multi-Status`），取数字码，避免子串误判。 */
export function statusLineCode(statusLine: string): number | null {
  const match = STATUS_LINE_PATTERN.exec(statusLine.trim())
  return match?.[1] === undefined ? null : Number(match[1])
}

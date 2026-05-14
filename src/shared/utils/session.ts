import crypto from 'node:crypto'

export const generateSessionId = (protocol: string): string => {
  const randomBytes = crypto.randomBytes(8).toString('base64url')
  return `${protocol}_${Date.now()}_${randomBytes}`
}

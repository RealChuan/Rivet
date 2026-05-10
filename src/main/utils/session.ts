export const generateSessionId = (protocol: string): string => {
  return `${protocol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

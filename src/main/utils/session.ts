export const generateSessionId = (protocol: string): string => {
  return `${protocol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export interface SessionHandle<T = any> {
  client: T
  config: {
    host: string
    username: string
    password?: string
    privateKey?: string
    basePath?: string
  }
}

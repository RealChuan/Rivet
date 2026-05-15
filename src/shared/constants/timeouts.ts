export const TIMEOUTS = {
  FORCE_EXIT: 10000,
  HEARTBEAT_INTERVAL: 30000,
  PING: 5000,
  DISCONNECT: 5000,
  SFTP_READY: 20000,
  AGENT: 30000,
} as const

export type TimeoutKey = keyof typeof TIMEOUTS

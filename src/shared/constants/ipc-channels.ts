export const IPC_CHANNELS = {
  COMMON: {
    GET_APP_VERSION: 'common:get-app-version',
  },
  PROTOCOL: {
    CONNECT: 'protocol:connect',
    LIST: 'protocol:list',
  },
} as const

export type IpcChannels = typeof IPC_CHANNELS

export const IPC_CHANNELS = {
  COMMON: {
    GET_APP_VERSION: 'common:get-app-version',
  },
  PROTOCOL: {
    CONNECT: 'protocol:connect',
    DISCONNECT: 'protocol:disconnect',
    LIST: 'protocol:list',
    MKDIR: 'protocol:mkdir',
    RENAME: 'protocol:rename',
    DELETE: 'protocol:delete',
    COPY: 'protocol:copy',
    MOVE: 'protocol:move',
    UPLOAD_FILE: 'protocol:upload-file',
    DOWNLOAD_FILE: 'protocol:download-file',
    CANCEL_TRANSFER: 'protocol:cancel-transfer',
    SAVE_KNOWN_HOST: 'protocol:save-known-host',
    DELETE_KNOWN_HOST: 'protocol:delete-known-host',
  },
  EVENTS: {
    TRANSFER_PROGRESS: 'transfer-progress',
    SESSION_DISCONNECTED: 'session-disconnected',
  },
} as const

export type IpcChannels = typeof IPC_CHANNELS

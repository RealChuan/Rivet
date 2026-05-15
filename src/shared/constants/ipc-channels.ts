export const IPC_CHANNELS = {
  COMMON: {
    GET_APP_VERSION: 'common:get-app-version',
    STORE_GET: 'common:store-get',
    STORE_SET: 'common:store-set',
    STORE_DELETE: 'common:store-delete',
    GET_SAVED_CONNECTIONS: 'common:get-saved-connections',
    DELETE_CONNECTION: 'common:delete-connection',
    GET_CREDENTIAL: 'common:get-credential',
    GET_TEMP_DIR: 'common:get-temp-dir',
    GET_DOWNLOAD_DIR: 'common:get-download-dir',
    SHOW_OPEN_DIALOG: 'common:show-open-dialog',
    SHOW_SAVE_DIALOG: 'common:show-save-dialog',
    GET_IS_PACKAGED: 'common:get-is-packaged',
    SAVE_KNOWN_HOST: 'common:save-known-host',
    DELETE_KNOWN_HOST: 'common:delete-known-host',
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
  },
  EVENTS: {
    SESSION_DISCONNECTED: 'session-disconnected',
  },
} as const

export type IpcChannels = typeof IPC_CHANNELS

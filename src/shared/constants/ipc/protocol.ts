export const PROTOCOL_CHANNELS = {
  CONNECT: 'protocol:connect',
  DISCONNECT: 'protocol:disconnect',
  LIST: 'protocol:list',
  MKDIR: 'protocol:mkdir',
  RENAME: 'protocol:rename',
  DELETE: 'protocol:delete',
  COPY: 'protocol:copy',
  MOVE: 'protocol:move',
  CANCEL: 'protocol:cancel',
  CALCULATE_FOLDER_STATS: 'protocol:calculate-folder-stats',
  CANCEL_CALCULATE_FOLDER_STATS: 'protocol:cancel-calculate-folder-stats',
  FOLDER_STATS_PROGRESS: 'protocol:folder-stats-progress',
} as const
